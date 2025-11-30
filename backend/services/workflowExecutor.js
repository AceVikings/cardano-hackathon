/**
 * Workflow Executor Service
 *
 * This service handles the core execution logic for workflows.
 * It's designed to be trigger-agnostic, so it can be used by:
 * - Manual triggers (user clicks "Execute")
 * - Cron triggers (scheduled execution)
 * - Price triggers (when price conditions are met)
 * - Webhook triggers (external API calls)
 * - Wallet receive triggers (when tokens are received)
 */

const Workflow = require("../models/Workflow");

// Execution status enum
const ExecutionStatus = {
  PENDING: "pending",
  RUNNING: "running",
  SUCCESS: "success",
  FAILED: "failed",
  PARTIAL: "partial", // Some nodes succeeded, some failed
};

// Trigger types that can initiate execution
const TriggerType = {
  MANUAL: "manual",
  CRON: "cron",
  PRICE_GTE: "price_gte",
  PRICE_LTE: "price_lte",
  WALLET_RECEIVE: "wallet_receive",
  WEBHOOK: "webhook",
};

// ============================================================================
// Live Execution Tracker (in-memory store for active executions)
// ============================================================================
const liveExecutions = new Map();

function getLiveExecution(executionId) {
  return liveExecutions.get(executionId) || null;
}

function updateLiveExecution(executionId, data) {
  const existing = liveExecutions.get(executionId) || {};
  liveExecutions.set(executionId, { ...existing, ...data, updatedAt: Date.now() });
}

function addLiveNodeUpdate(executionId, nodeUpdate) {
  const execution = liveExecutions.get(executionId);
  if (execution) {
    const nodeIndex = execution.nodeResults?.findIndex(n => n.nodeId === nodeUpdate.nodeId);
    if (nodeIndex >= 0) {
      execution.nodeResults[nodeIndex] = { ...execution.nodeResults[nodeIndex], ...nodeUpdate };
    } else {
      execution.nodeResults = execution.nodeResults || [];
      execution.nodeResults.push(nodeUpdate);
    }
    execution.updatedAt = Date.now();
  }
}

function cleanupLiveExecution(executionId) {
  // Keep execution data for 5 minutes after completion for final poll
  setTimeout(() => {
    liveExecutions.delete(executionId);
  }, 5 * 60 * 1000);
}

/**
 * Build execution graph from workflow nodes and edges
 * Returns nodes in topological order (dependencies first)
 */
function buildExecutionGraph(nodes, edges) {
  // Create adjacency list and in-degree count
  const graph = new Map();
  const inDegree = new Map();
  const nodeMap = new Map();

  // Initialize
  for (const node of nodes) {
    graph.set(node.id, []);
    inDegree.set(node.id, 0);
    nodeMap.set(node.id, node);
  }

  // Build graph from edges
  for (const edge of edges) {
    if (graph.has(edge.source) && graph.has(edge.target)) {
      graph.get(edge.source).push(edge.target);
      inDegree.set(edge.target, inDegree.get(edge.target) + 1);
    }
  }

  // Topological sort using Kahn's algorithm
  const queue = [];
  const result = [];

  // Start with nodes that have no dependencies (triggers)
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  while (queue.length > 0) {
    const nodeId = queue.shift();
    const node = nodeMap.get(nodeId);
    result.push(node);

    for (const neighbor of graph.get(nodeId)) {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  return result;
}

/**
 * Get input values for a node based on connections and configured values
 */
function resolveNodeInputs(node, edges, nodeOutputs) {
  const inputs = {};
  const nodeData = node.data || {};
  const inputParameters = nodeData.inputParameters || [];
  const configuredValues = nodeData.inputValues || new Map();
  console.log("[Resolver] Node:", node.id);
  console.log("[Resolver] INPUT params:", inputParameters);
  console.log("[Resolver] CONFIGURED VALUES:", configuredValues);
  console.log("[Resolver] Available node outputs:", [...nodeOutputs.keys()]);
  
  for (const param of inputParameters) {
    // Check if there's a connection providing this input
    const targetHandleName = `input-${param.name}`;
    const incomingEdge = edges.find(
      (e) => e.target === node.id && e.targetHandle === targetHandleName
    );

    console.log(`[Resolver] Looking for edge to ${targetHandleName}:`, incomingEdge ? 
      `Found! source=${incomingEdge.source}, sourceHandle=${incomingEdge.sourceHandle}` : 
      "Not found");

    if (incomingEdge && nodeOutputs.has(incomingEdge.source)) {
      // Get value from connected node's output
      const sourceOutput = nodeOutputs.get(incomingEdge.source);
      const sourceHandle = incomingEdge.sourceHandle;
      
      console.log(`[Resolver] Source output keys:`, Object.keys(sourceOutput || {}));

      if (sourceHandle && sourceHandle.startsWith("output-")) {
        const outputName = sourceHandle.replace("output-", "");
        console.log(`[Resolver] Extracting output field: ${outputName} = `, sourceOutput[outputName]);
        inputs[param.name] = sourceOutput[outputName];
      } else {
        // Default output
        inputs[param.name] = sourceOutput.default || sourceOutput;
      }
    } else if (configuredValues.has && configuredValues.has(param.name)) {
      // Use manually configured value (inputValues is a Map)
      const configValue = configuredValues.get(param.name);
      inputs[param.name] = configValue.value;
      console.log(
        `[Resolver] Using configured value for ${param.name}:`,
        configValue.value
      );
    } else {
      console.log(`[Resolver] No value found for ${param.name}`);
    }
  }

  console.log("[Resolver] Final inputs:", inputs);
  return inputs;
}

/**
 * Extract input parameters from the workflow itself for manual execution
 */
function extractWorkflowInputs(workflow) {
  const { nodes } = workflow;
  const inputs = {};
  // Extract inputs from all nodes that have configured input values
  for (const node of nodes) {
    if (node.data?.inputValues) {
      // inputValues is a Map, convert to object
      const nodeInputs = {};
      for (const [key, value] of node.data.inputValues) {
        nodeInputs[key] = value.value; // Extract the actual value
      }

      if (Object.keys(nodeInputs).length > 0) {
        inputs[node.id] = nodeInputs;
      }
    }

    // Also extract trigger configuration if it exists
    if (node.type === "trigger" && node.data?.triggerConfig) {
      inputs[node.id] = {
        ...inputs[node.id],
        ...node.data.triggerConfig,
      };
    }
  }

  return inputs;
}

/**
 * Execute a single agent node
 */
async function executeAgentNode(node, inputs, context) {
  const { invokeUrl, agentId } = node.data || {};

  if (!invokeUrl) {
    throw new Error(`Agent node ${node.id} has no invoke URL configured`);
  }

  console.log(`[Executor] Executing agent: ${agentId || node.id}`);
  console.log(`[Executor] Inputs:`, inputs);
  console.log(`[Executor] Invoke URL:`, invokeUrl);

  // Make HTTP call to the agent service
  const axios = require("axios");

  try {
    const response = await axios.post(
      `http://localhost:5001${invokeUrl}`, // Assuming the backend runs on port 5001
      inputs,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: context.authorization || "", // Pass auth if available
        },
      }
    );

    const result = response.data;

    if (result.success) {
      return result;
    } else {
      throw new Error(result.error || "Agent execution failed");
    }
  } catch (error) {
    console.error(
      `[Executor] Agent call failed:`,
      error.response?.data || error.message
    );
    throw new Error(
      `Agent execution failed: ${error.response?.data?.error || error.message}`
    );
  }
}

/**
 * Main workflow execution function
 *
 * @param {string} workflowId - The workflow to execute
 * @param {string} triggerType - The type of trigger initiating execution
 * @param {object} triggerData - Additional data from the trigger (e.g., price, webhook payload)
 * @param {object} context - Execution context (userId, etc.)
 * @returns {object} Execution result with status and node outputs
 */
async function executeWorkflow(
  workflowId,
  triggerType,
  triggerData = {},
  context = {}
) {
  // Use client-provided executionId or generate one
  const executionId = context.executionId || `exec_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const startTime = Date.now();

  console.log(
    `[Executor] Starting execution ${executionId} for workflow ${workflowId}`
  );
  console.log(`[Executor] Trigger: ${triggerType}`, triggerData);

  // Initialize live execution tracking
  updateLiveExecution(executionId, {
    executionId,
    workflowId,
    status: ExecutionStatus.RUNNING,
    startTime: new Date(startTime).toISOString(),
    nodeResults: [],
    currentNode: null,
  });

  // Fetch the workflow
  const workflow = await Workflow.findById(workflowId);

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  // Verify user has access (if context includes userId)
  if (
    context.userId &&
    workflow.userId.toString() !== context.userId.toString()
  ) {
    throw new Error("Unauthorized: You do not have access to this workflow");
  }

  // Check if workflow is active (skip for manual triggers)
  if (triggerType !== TriggerType.MANUAL && workflow.status !== "active") {
    throw new Error("Workflow is not active");
  }

  const { nodes, edges } = workflow;

  // Find the trigger node
  const triggerNode = nodes.find((n) => n.type === "trigger");
  if (!triggerNode) {
    throw new Error("Workflow has no trigger node");
  }

  // For manual execution, extract input parameters from the workflow itself
  let executionTriggerData = triggerData;
  if (triggerType === TriggerType.MANUAL) {
    // Extract configured input values from the workflow
    executionTriggerData = extractWorkflowInputs(workflow);
  }

  // Verify trigger type matches (for non-manual triggers)
  if (triggerType !== TriggerType.MANUAL) {
    const workflowTriggerType = triggerNode.data?.triggerType;
    if (workflowTriggerType !== triggerType) {
      throw new Error(
        `Trigger type mismatch: expected ${workflowTriggerType}, got ${triggerType}`
      );
    }
  }

  // Build execution order
  const executionOrder = buildExecutionGraph(nodes, edges);

  // Track outputs from each node
  const nodeOutputs = new Map();
  const nodeResults = [];
  let overallStatus = ExecutionStatus.SUCCESS;
  let failedNodes = 0;

  // Update live execution with workflow info
  updateLiveExecution(executionId, {
    workflowName: workflow.name,
    totalNodes: executionOrder.length,
  });

  // Execute nodes in order
  for (const node of executionOrder) {
    const nodeStartTime = Date.now();
    let nodeResult = {
      nodeId: node.id,
      nodeType: node.type,
      label: node.data?.label,
      agentId: node.data?.agentId || null,
      status: ExecutionStatus.RUNNING,
      startTime: new Date(nodeStartTime).toISOString(),
    };

    // Update live status - node is now running
    updateLiveExecution(executionId, { currentNode: node.id });
    addLiveNodeUpdate(executionId, { ...nodeResult });

    try {
      if (node.type === "trigger") {
        // Trigger nodes pass through the execution trigger data
        nodeOutputs.set(node.id, {
          triggerData: executionTriggerData,
          triggered: true,
        });
        nodeResult.status = ExecutionStatus.SUCCESS;
        nodeResult.output = { triggered: true };
      } else if (node.type === "agent") {
        // Resolve inputs from connections and configured values
        const inputs = resolveNodeInputs(node, edges, nodeOutputs);
        
        // Store inputs in nodeResult for logging
        nodeResult.inputs = inputs;
        nodeResult.agentId = node.data?.agentId;

        // Execute the agent
        const result = await executeAgentNode(node, inputs, {
          ...context,
          triggerData: executionTriggerData,
          executionId,
        });

        if (result.success) {
          nodeOutputs.set(node.id, result.output || result);
          nodeResult.status = ExecutionStatus.SUCCESS;
          nodeResult.output = result.output || result;
        } else {
          throw new Error(result.error || "Agent execution failed");
        }
      }
    } catch (error) {
      console.error(`[Executor] Node ${node.id} failed:`, error.message);
      nodeResult.status = ExecutionStatus.FAILED;
      nodeResult.error = error.message;
      failedNodes++;

      // Continue execution for other branches (don't stop entire workflow)
      // In the future, we could add configuration for fail-fast behavior
    }

    nodeResult.endTime = new Date().toISOString();
    nodeResult.duration = Date.now() - nodeStartTime;
    nodeResults.push(nodeResult);
    
    // Update live status - node completed
    addLiveNodeUpdate(executionId, { ...nodeResult });
  }

  // Determine overall status
  if (failedNodes === 0) {
    overallStatus = ExecutionStatus.SUCCESS;
  } else if (
    failedNodes === nodeResults.filter((n) => n.nodeType === "agent").length
  ) {
    overallStatus = ExecutionStatus.FAILED;
  } else {
    overallStatus = ExecutionStatus.PARTIAL;
  }

  // Update workflow stats
  await Workflow.findByIdAndUpdate(workflowId, {
    $inc: {
      "stats.totalExecutions": 1,
      "stats.successfulExecutions":
        overallStatus === ExecutionStatus.SUCCESS ? 1 : 0,
      "stats.failedExecutions":
        overallStatus === ExecutionStatus.FAILED ? 1 : 0,
    },
    $set: {
      "stats.lastExecutedAt": new Date(),
    },
  });

  const endTime = Date.now();

  const executionResult = {
    executionId,
    workflowId,
    workflowName: workflow.name,
    triggerType,
    triggerData: executionTriggerData,
    status: overallStatus,
    nodeResults,
    summary: {
      totalNodes: nodeResults.length,
      successfulNodes: nodeResults.filter(
        (n) => n.status === ExecutionStatus.SUCCESS
      ).length,
      failedNodes,
    },
    timing: {
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      duration: endTime - startTime,
    },
  };

  // Update live execution with final status
  updateLiveExecution(executionId, {
    status: overallStatus,
    currentNode: null,
    nodeResults,
    summary: executionResult.summary,
    timing: executionResult.timing,
    completed: true,
  });
  
  // Schedule cleanup of live execution data
  cleanupLiveExecution(executionId);

  console.log(
    `[Executor] Execution ${executionId} completed with status: ${overallStatus}`
  );

  return executionResult;
}

/**
 * Validate that a workflow can be executed
 */
async function validateWorkflow(workflowId, context = {}) {
  const workflow = await Workflow.findById(workflowId);

  if (!workflow) {
    return { valid: false, error: "Workflow not found" };
  }

  if (
    context.userId &&
    workflow.userId.toString() !== context.userId.toString()
  ) {
    return { valid: false, error: "Unauthorized" };
  }

  const { nodes, edges } = workflow;

  // Check for trigger node
  const triggerNodes = nodes.filter((n) => n.type === "trigger");
  if (triggerNodes.length === 0) {
    return { valid: false, error: "Workflow has no trigger node" };
  }
  if (triggerNodes.length > 1) {
    return { valid: false, error: "Workflow has multiple trigger nodes" };
  }

  // Check for at least one agent node
  const agentNodes = nodes.filter((n) => n.type === "agent");
  if (agentNodes.length === 0) {
    return { valid: false, error: "Workflow has no agent nodes" };
  }

  // Check that all agent nodes are connected
  const connectedAgents = new Set();
  for (const edge of edges) {
    connectedAgents.add(edge.target);
  }

  const disconnectedAgents = agentNodes.filter(
    (n) => !connectedAgents.has(n.id)
  );
  if (disconnectedAgents.length > 0) {
    return {
      valid: false,
      error: `Some agent nodes are not connected: ${disconnectedAgents
        .map((n) => n.data?.label)
        .join(", ")}`,
    };
  }

  return { valid: true, workflow };
}

module.exports = {
  executeWorkflow,
  validateWorkflow,
  buildExecutionGraph,
  getLiveExecution,
  ExecutionStatus,
  TriggerType,
};
