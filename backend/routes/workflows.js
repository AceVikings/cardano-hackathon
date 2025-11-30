const express = require("express");
const router = express.Router();
const Workflow = require("../models/Workflow");
const { authenticate } = require("../middleware/auth");
const {
  executeWorkflow,
  validateWorkflow,
  TriggerType,
} = require("../services/workflowExecutor");

// All routes require authentication
router.use(authenticate);

// ============================================================================
// GET /api/workflows - Get all workflows for current user (basic info only)
// ============================================================================
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;

    // Build query
    const query = { userId: req.user._id };
    if (status && ["active", "inactive"].includes(status)) {
      query.status = status;
    }

    // Fetch workflows with only basic fields (no nodes/edges)
    const workflows = await Workflow.find(query)
      .select("name description status stats createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    // Add node/edge counts from a separate aggregation for efficiency
    const workflowIds = workflows.map((w) => w._id);
    const counts = await Workflow.aggregate([
      { $match: { _id: { $in: workflowIds } } },
      {
        $project: {
          _id: 1,
          nodeCount: { $size: { $ifNull: ["$nodes", []] } },
          edgeCount: { $size: { $ifNull: ["$edges", []] } },
        },
      },
    ]);

    // Create a map for quick lookup
    const countMap = new Map(counts.map((c) => [c._id.toString(), c]));

    // Combine data
    const result = workflows.map((w) => ({
      id: w._id,
      name: w.name,
      description: w.description,
      status: w.status,
      nodeCount: countMap.get(w._id.toString())?.nodeCount || 0,
      edgeCount: countMap.get(w._id.toString())?.edgeCount || 0,
      stats: w.stats,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));

    res.json({
      success: true,
      workflows: result,
      count: result.length,
    });
  } catch (error) {
    console.error("Error fetching workflows:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch workflows",
    });
  }
});

// ============================================================================
// GET /api/workflows/executions/recent - Get recent executions across all user workflows
// ============================================================================
router.get("/executions/recent", async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 20, 50);

    // Aggregate recent executions from all user workflows
    const workflows = await Workflow.find({
      userId: req.user._id,
      "recentExecutions.0": { $exists: true }, // Only workflows with executions
    })
      .select("name recentExecutions")
      .lean();

    // Flatten and enrich executions with workflow info
    const allExecutions = [];
    for (const workflow of workflows) {
      for (const execution of workflow.recentExecutions || []) {
        allExecutions.push({
          ...execution,
          workflowId: workflow._id,
          workflowName: workflow.name,
        });
      }
    }

    // Sort by executedAt descending and limit
    allExecutions.sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt));
    const recentExecutions = allExecutions.slice(0, parsedLimit);

    res.json({
      success: true,
      executions: recentExecutions,
      count: recentExecutions.length,
      totalAvailable: allExecutions.length,
    });
  } catch (error) {
    console.error("Error fetching recent executions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch recent executions",
    });
  }
});

// ============================================================================
// GET /api/workflows/:id - Get single workflow by ID (full data)
// ============================================================================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const workflow = await Workflow.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: "Workflow not found",
      });
    }

    res.json({
      success: true,
      workflow: {
        id: workflow._id,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        nodes: workflow.nodes,
        edges: workflow.edges,
        viewport: workflow.viewport,
        stats: workflow.stats,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching workflow:", error);

    // Handle invalid ObjectId
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        error: "Invalid workflow ID",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to fetch workflow",
    });
  }
});

// ============================================================================
// POST /api/workflows - Create new workflow
// ============================================================================
router.post("/", async (req, res) => {
  try {
    const { name, description, nodes, edges, viewport, status } = req.body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Workflow name is required",
      });
    }

    // Create workflow
    const workflow = new Workflow({
      userId: req.user._id,
      name: name.trim(),
      description: description?.trim() || "",
      status: status === "active" ? "active" : "inactive",
      nodes: nodes || [],
      edges: edges || [],
      viewport: viewport || { x: 0, y: 0, zoom: 1 },
    });

    await workflow.save();

    res.status(201).json({
      success: true,
      workflow: {
        id: workflow._id,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        nodes: workflow.nodes,
        edges: workflow.edges,
        viewport: workflow.viewport,
        stats: workflow.stats,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error creating workflow:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        error: "Invalid workflow data",
        details: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create workflow",
    });
  }
});

// ============================================================================
// PUT /api/workflows/:id - Update workflow
// ============================================================================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, nodes, edges, viewport, status } = req.body;

    // Find workflow
    const workflow = await Workflow.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: "Workflow not found",
      });
    }

    // Update fields if provided
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "Workflow name cannot be empty",
        });
      }
      workflow.name = name.trim();
    }

    if (description !== undefined) {
      workflow.description = description?.trim() || "";
    }

    if (status !== undefined) {
      if (!["active", "inactive"].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Status must be "active" or "inactive"',
        });
      }
      workflow.status = status;
    }

    if (nodes !== undefined) {
      workflow.nodes = nodes;
    }

    if (edges !== undefined) {
      workflow.edges = edges;
    }

    if (viewport !== undefined) {
      workflow.viewport = viewport;
    }

    await workflow.save();

    res.json({
      success: true,
      workflow: {
        id: workflow._id,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        nodes: workflow.nodes,
        edges: workflow.edges,
        viewport: workflow.viewport,
        stats: workflow.stats,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating workflow:", error);

    // Handle invalid ObjectId
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        error: "Invalid workflow ID",
      });
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        error: "Invalid workflow data",
        details: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to update workflow",
    });
  }
});

// ============================================================================
// PATCH /api/workflows/:id/status - Toggle workflow status
// ============================================================================
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be "active" or "inactive"',
      });
    }

    const workflow = await Workflow.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { status, updatedAt: new Date() },
      { new: true }
    ).select("name description status stats createdAt updatedAt");

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: "Workflow not found",
      });
    }

    res.json({
      success: true,
      workflow: {
        id: workflow._id,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        stats: workflow.stats,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating workflow status:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        error: "Invalid workflow ID",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to update workflow status",
    });
  }
});

// ============================================================================
// DELETE /api/workflows/:id - Delete workflow
// ============================================================================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const workflow = await Workflow.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: "Workflow not found",
      });
    }

    res.json({
      success: true,
      message: "Workflow deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting workflow:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        error: "Invalid workflow ID",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to delete workflow",
    });
  }
});

// ============================================================================
// POST /api/workflows/:id/execute - Execute workflow manually
// ============================================================================
router.post("/:id/execute", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate workflow first
    const validation = await validateWorkflow(id, { userId: req.user._id });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    // Execute the workflow using input parameters from the workflow itself
    const result = await executeWorkflow(id, TriggerType.MANUAL, null, {
      userId: req.user._id,
      authorization: req.headers.authorization,
    });

    // Build agent-wise logs from nodeResults
    const agentLogs = result.nodeResults
      .filter(node => node.nodeType === 'agent')
      .map(node => ({
        nodeId: node.nodeId,
        agentId: node.agentId || node.nodeId,
        label: node.label,
        status: node.status,
        startTime: node.startTime ? new Date(node.startTime) : null,
        endTime: node.endTime ? new Date(node.endTime) : null,
        duration: node.duration,
        inputs: node.inputs || {},
        output: node.output || null,
        error: node.error || null,
      }));

    // Create execution log entry
    const executionLog = {
      executionId: result.executionId,
      triggerType: result.triggerType,
      status: result.status,
      executedAt: new Date(result.timing.startTime),
      duration: result.timing.duration,
      summary: result.summary,
      agentLogs,
      triggerData: result.triggerData,
    };

    // Update workflow with new execution log (keep last 10)
    await Workflow.findByIdAndUpdate(id, {
      $push: {
        recentExecutions: {
          $each: [executionLog],
          $slice: -10, // Keep only last 10 executions
        },
      },
    });

    res.json({
      success: true,
      execution: result,
    });
  } catch (error) {
    console.error("Error executing workflow:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        error: "Invalid workflow ID",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Failed to execute workflow",
    });
  }
});

// ============================================================================
// GET /api/workflows/:id/executions - Get recent execution history
// ============================================================================
router.get("/:id/executions", async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;

    const workflow = await Workflow.findOne({
      _id: id,
      userId: req.user._id,
    }).select("name recentExecutions");

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: "Workflow not found",
      });
    }

    // Get executions, most recent first
    const executions = (workflow.recentExecutions || [])
      .slice(-parseInt(limit))
      .reverse();

    res.json({
      success: true,
      workflowId: id,
      workflowName: workflow.name,
      executions,
      count: executions.length,
    });
  } catch (error) {
    console.error("Error fetching executions:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        error: "Invalid workflow ID",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to fetch execution history",
    });
  }
});

// ============================================================================
// GET /api/workflows/:id/executions/:executionId - Get specific execution details
// ============================================================================
router.get("/:id/executions/:executionId", async (req, res) => {
  try {
    const { id, executionId } = req.params;

    const workflow = await Workflow.findOne({
      _id: id,
      userId: req.user._id,
    }).select("name recentExecutions");

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: "Workflow not found",
      });
    }

    const execution = (workflow.recentExecutions || []).find(
      (e) => e.executionId === executionId
    );

    if (!execution) {
      return res.status(404).json({
        success: false,
        error: "Execution not found",
      });
    }

    res.json({
      success: true,
      workflowId: id,
      workflowName: workflow.name,
      execution,
    });
  } catch (error) {
    console.error("Error fetching execution:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        error: "Invalid workflow ID",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to fetch execution details",
    });
  }
});

// ============================================================================
// POST /api/workflows/:id/validate - Validate workflow without executing
// ============================================================================
router.post("/:id/validate", async (req, res) => {
  try {
    const { id } = req.params;

    const validation = await validateWorkflow(id, { userId: req.user._id });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: validation.error,
      });
    }

    // Return basic workflow info with validation result
    const workflow = validation.workflow;

    res.json({
      success: true,
      valid: true,
      workflow: {
        id: workflow._id,
        name: workflow.name,
        status: workflow.status,
        nodeCount: workflow.nodes?.length || 0,
        agentCount:
          workflow.nodes?.filter((n) => n.type === "agent").length || 0,
        triggerType: workflow.nodes?.find((n) => n.type === "trigger")?.data
          ?.triggerType,
      },
    });
  } catch (error) {
    console.error("Error validating workflow:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        error: "Invalid workflow ID",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to validate workflow",
    });
  }
});

module.exports = router;
