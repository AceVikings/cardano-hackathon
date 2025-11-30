import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import type { DragEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import type { Connection, Edge, Node, Viewport } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Save, FolderOpen, Loader2, Power, Trash2, Rocket, Play } from 'lucide-react';
import { motion } from 'framer-motion';

import AgentNode from './AgentNode';
import type { AgentNodeData } from './AgentNode';
import TriggerNode from './TriggerNode';
import AgentPalette from './AgentPalette';
import NodeConfigSidebar from './NodeConfigSidebar';
import ExecutionLogsSidebar from './ExecutionLogsSidebar';
import { useToast } from '../../context/ToastContext';
import {
  createWorkflow,
  updateWorkflow,
  getWorkflowById,
  updateWorkflowStatus,
  executeWorkflow as executeWorkflowApi,
  type WorkflowNode,
  type WorkflowEdge,
  type ExecutionResult,
} from '../../services/api';

// Custom node types
const nodeTypes = {
  agent: AgentNode,
  trigger: TriggerNode,
};

// Initial nodes with a manual trigger
const defaultNodes: Node[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 50, y: 200 },
    data: {
      label: 'Manual Trigger',
      triggerType: 'manual',
    },
  },
];

const defaultEdges: Edge[] = [];

let nodeId = 1;
const getId = () => `node_${nodeId++}`;

function AgentEditorCanvas() {
  const { workflowId } = useParams<{ workflowId?: string }>();
  const navigate = useNavigate();
  const { success, error } = useToast();
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
  const { screenToFlowPosition, getViewport, setViewport } = useReactFlow();
  
  // Workflow state
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [workflowStatus, setWorkflowStatus] = useState<'active' | 'inactive'>('inactive');
  const [isSaving, setIsSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [showExecutionLogs, setShowExecutionLogs] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Get the selected node
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [selectedNodeId, nodes]);

  // Get connected inputs for the selected node
  const connectedInputs = useMemo(() => {
    if (!selectedNodeId) return [];
    return edges
      .filter(e => e.target === selectedNodeId && e.targetHandle?.startsWith('input-'))
      .map(e => e.targetHandle?.replace('input-', '') || '');
  }, [selectedNodeId, edges]);

  // Handle node selection
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type === 'agent') {
      setSelectedNodeId(node.id);
    } else {
      setSelectedNodeId(null);
    }
  }, []);

  // Handle pane click to deselect
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Update node data
  const handleUpdateNode = useCallback((nodeId: string, data: Partial<AgentNodeData>) => {
    setNodes(nds => 
      nds.map(node => 
        node.id === nodeId 
          ? { ...node, data: { ...node.data, ...data } }
          : node
      )
    );
    setHasUnsavedChanges(true);
  }, [setNodes]);

  // Calculate total workflow execution cost
  const workflowCost = useMemo(() => {
    const agentNodes = nodes.filter(n => n.type === 'agent');
    let totalAda = 0;
    const GAS_ESTIMATE = 0.5; // Estimated gas cost in ADA per transaction
    
    agentNodes.forEach(node => {
      const data = node.data as unknown as AgentNodeData;
      if (data.executionCost) {
        // Parse cost string like "1 ADA" -> 1
        const costMatch = data.executionCost.match(/(\d+(?:\.\d+)?)/);
        if (costMatch) {
          totalAda += parseFloat(costMatch[1]);
        }
      }
    });
    
    // Add gas estimate if there are agents
    const gasEstimate = agentNodes.length > 0 ? GAS_ESTIMATE * agentNodes.length : 0;
    
    return {
      agentCost: totalAda,
      gasCost: gasEstimate,
      total: totalAda + gasEstimate,
      agentCount: agentNodes.length,
    };
  }, [nodes]);

  // Load existing workflow if workflowId is provided
  useEffect(() => {
    if (workflowId) {
      loadWorkflow(workflowId);
    }
  }, [workflowId]);

  // Track unsaved changes
  useEffect(() => {
    if (!isLoading) {
      setHasUnsavedChanges(true);
    }
  }, [nodes, edges]);

  const loadWorkflow = async (id: string) => {
    setIsLoading(true);
    try {
      const workflow = await getWorkflowById(id);
      
      // Convert API nodes to ReactFlow nodes
      const loadedNodes: Node[] = workflow.nodes.map((n: WorkflowNode) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      }));
      
      // Convert API edges to ReactFlow edges
      const loadedEdges: Edge[] = workflow.edges.map((e: WorkflowEdge) => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle,
        target: e.target,
        targetHandle: e.targetHandle,
        type: e.type || 'smoothstep',
        animated: e.animated,
        style: {
          stroke: e.sourceHandle?.includes('trigger') ? '#4ade80' : '#22d3ee',
          strokeWidth: 2,
        },
      }));
      
      setNodes(loadedNodes.length > 0 ? loadedNodes : defaultNodes);
      setEdges(loadedEdges);
      setWorkflowName(workflow.name);
      setWorkflowDescription(workflow.description || '');
      setWorkflowStatus(workflow.status);
      
      // Restore viewport
      if (workflow.viewport) {
        setTimeout(() => {
          setViewport(workflow.viewport);
        }, 100);
      }
      
      // Update node ID counter to avoid conflicts
      const maxNodeId = loadedNodes.reduce((max, n) => {
        const match = n.id.match(/node_(\d+)/);
        return match ? Math.max(max, parseInt(match[1])) : max;
      }, 0);
      nodeId = maxNodeId + 1;
      
      setHasUnsavedChanges(false);
      success('Workflow loaded', workflow.name);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load workflow';
      error('Failed to load workflow', message);
      navigate('/editor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!workflowName.trim()) {
      setShowSaveModal(true);
      return;
    }
    
    await saveWorkflow();
  };

  const saveWorkflow = async () => {
    setIsSaving(true);
    try {
      const viewport: Viewport = getViewport();
      
      // Convert ReactFlow nodes to API format
      const workflowNodes: WorkflowNode[] = nodes.map((n) => ({
        id: n.id,
        type: n.type as 'trigger' | 'agent',
        position: n.position,
        data: n.data as WorkflowNode['data'],
      }));
      
      // Convert ReactFlow edges to API format
      const workflowEdges: WorkflowEdge[] = edges.map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle || undefined,
        target: e.target,
        targetHandle: e.targetHandle || undefined,
        type: e.type,
        animated: e.animated,
      }));

      if (workflowId) {
        // Update existing workflow
        await updateWorkflow(workflowId, {
          name: workflowName,
          description: workflowDescription,
          nodes: workflowNodes,
          edges: workflowEdges,
          viewport,
        });
        success('Workflow saved', 'Your changes have been saved');
      } else {
        // Create new workflow
        const newWorkflow = await createWorkflow({
          name: workflowName,
          description: workflowDescription,
          nodes: workflowNodes,
          edges: workflowEdges,
          viewport,
        });
        success('Workflow created', newWorkflow.name);
        // Navigate to the new workflow's edit URL
        navigate(`/editor/${newWorkflow.id}`, { replace: true });
      }
      
      setHasUnsavedChanges(false);
      setShowSaveModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save workflow';
      error('Failed to save', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!workflowId) {
      error('Save first', 'Please save the workflow before activating it');
      return;
    }
    
    try {
      const newStatus = workflowStatus === 'active' ? 'inactive' : 'active';
      await updateWorkflowStatus(workflowId, newStatus);
      setWorkflowStatus(newStatus);
      success(
        newStatus === 'active' ? 'Workflow activated' : 'Workflow deactivated',
        newStatus === 'active' ? 'Your workflow is now running' : 'Your workflow has been paused'
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update status';
      error('Failed to update status', message);
    }
  };

  const handleExecute = async () => {
    if (!workflowId) {
      error('Save first', 'Please save the workflow before executing it');
      return;
    }

    // Check if there are agent nodes
    const agentNodes = nodes.filter(n => n.type === 'agent');
    if (agentNodes.length === 0) {
      error('No agents', 'Add at least one agent to your workflow before executing');
      return;
    }

    // Close config sidebar and show execution logs
    setSelectedNodeId(null);
    setExecutionResult(null);
    setShowExecutionLogs(true);
    setIsExecuting(true);
    
    try {
      const result = await executeWorkflowApi(workflowId);
      setExecutionResult(result);
      
      if (result.status === 'success') {
        success(
          'Execution complete',
          `${result.summary.successfulNodes}/${result.summary.totalNodes} nodes executed successfully`
        );
      } else if (result.status === 'partial') {
        error(
          'Partial execution',
          `${result.summary.failedNodes} node(s) failed. Check logs for details.`
        );
      } else {
        error('Execution failed', 'The workflow failed to execute');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to execute workflow';
      error('Execution failed', message);
      setExecutionResult({
        executionId: 'error',
        workflowId: workflowId,
        workflowName: workflowName,
        triggerType: 'manual',
        status: 'failed',
        nodeResults: [],
        summary: { totalNodes: 0, successfulNodes: 0, failedNodes: 1 },
        timing: { startTime: new Date().toISOString(), endTime: new Date().toISOString(), duration: 0 },
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceHandle = connection.sourceHandle || '';
      const targetHandle = connection.targetHandle || '';
      
      const sourceIsTrigger = sourceHandle.includes('trigger');
      const targetIsTrigger = targetHandle.includes('trigger');
      
      if (sourceIsTrigger !== targetIsTrigger) {
        console.warn('Cannot connect trigger handle to data handle');
        return;
      }

      const isTriggerEdge = sourceIsTrigger;
      const edge: Edge = {
        ...connection,
        id: `edge-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
        type: 'smoothstep',
        animated: isTriggerEdge,
        style: {
          stroke: isTriggerEdge ? '#4ade80' : '#22d3ee',
          strokeWidth: 2,
        },
      };
      setEdges((eds) => addEdge(edge, eds));
    },
    [setEdges]
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow-type');
      const dataString = event.dataTransfer.getData('application/reactflow-data');

      if (!type || !dataString) return;

      const data = JSON.parse(dataString);

      if (type === 'trigger') {
        const existingTrigger = nodes.find((n) => n.type === 'trigger');
        if (existingTrigger) {
          error('Only one trigger allowed', 'Remove the existing trigger first');
          return;
        }
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes, nodes, error]
  );

  const onDragStart = (event: DragEvent, nodeType: string, data: Record<string, unknown>) => {
    event.dataTransfer.setData('application/reactflow-type', nodeType);
    event.dataTransfer.setData('application/reactflow-data', JSON.stringify(data));
    event.dataTransfer.effectAllowed = 'move';
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-aqua-glow animate-spin mx-auto mb-4" />
          <p className="text-sea-mist">Loading workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-sea-mist/10 bg-abyss/50">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={workflowName}
            onChange={(e) => {
              setWorkflowName(e.target.value);
              setHasUnsavedChanges(true);
            }}
            className="bg-transparent text-foam-white font-semibold text-lg border-none outline-none focus:ring-1 focus:ring-aqua-glow/50 rounded px-2 py-1"
            placeholder="Workflow name..."
          />
          {hasUnsavedChanges && (
            <span className="text-xs text-sea-mist/50">Unsaved changes</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Workflow Cost Estimate */}
          {workflowCost.agentCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 text-sea-mist/70 text-xs">
              <span className="text-sea-mist/50">~</span>
              <span className="font-mono text-aqua-glow/80">
                {workflowCost.total.toFixed(2)} ADA
              </span>
              <span className="text-sea-mist/40 hidden sm:inline">
                ({workflowCost.agentCount} agent{workflowCost.agentCount !== 1 ? 's' : ''})
              </span>
            </div>
          )}
          
          <div className="w-px h-5 bg-sea-mist/10 hidden sm:block" />

          {/* My Workflows */}
          <motion.button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sea-mist/10 text-sea-mist hover:bg-sea-mist/20 transition-colors text-sm font-medium"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <FolderOpen className="w-4 h-4" />
            <span className="hidden sm:inline">My Workflows</span>
          </motion.button>

          {/* Clear Canvas */}
          <motion.button
            onClick={() => {
              if (confirm('Clear all nodes and connections? This cannot be undone.')) {
                setNodes(defaultNodes);
                setEdges([]);
                success('Canvas cleared');
              }
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sea-mist/10 text-sea-mist hover:bg-coral/20 hover:text-coral transition-colors text-sm font-medium"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Clear</span>
          </motion.button>

          {/* Save */}
          <motion.button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sea-mist/10 text-sea-mist hover:bg-sea-mist/20 transition-colors text-sm font-medium disabled:opacity-50"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{workflowId ? 'Save' : 'Save'}</span>
          </motion.button>

          {/* Run / Execute */}
          <motion.button
            onClick={handleExecute}
            disabled={!workflowId || isExecuting}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              !workflowId || isExecuting
                ? 'bg-sea-mist/10 text-sea-mist/50 cursor-not-allowed'
                : 'bg-bioluminescent/20 text-bioluminescent hover:bg-bioluminescent/30 border border-bioluminescent/30'
            }`}
            whileHover={workflowId && !isExecuting ? { scale: 1.02 } : {}}
            whileTap={workflowId && !isExecuting ? { scale: 0.98 } : {}}
          >
            {isExecuting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Run</span>
          </motion.button>

          {/* Status Toggle / Deploy */}
          <motion.button
            onClick={handleToggleStatus}
            disabled={!workflowId}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              workflowStatus === 'active'
                ? 'bg-bioluminescent text-deep-ocean'
                : 'bg-aqua-glow text-deep-ocean'
            } ${!workflowId ? 'opacity-50 cursor-not-allowed' : ''}`}
            whileHover={workflowId ? { scale: 1.02 } : {}}
            whileTap={workflowId ? { scale: 0.98 } : {}}
          >
            {workflowStatus === 'active' ? (
              <>
                <Power className="w-4 h-4" />
                Active
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                Deploy
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex flex-1 overflow-hidden">
        <AgentPalette onDragStart={onDragStart} />

        <div ref={reactFlowWrapper} className="flex-1 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#22d3ee', strokeWidth: 2 },
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Controls 
              className="!bg-abyss !border-sea-mist/20 !rounded-lg [&>button]:!bg-abyss [&>button]:!border-sea-mist/20 [&>button]:!text-sea-mist [&>button:hover]:!bg-current-blue/20"
            />
            <MiniMap
              nodeColor={(node) => {
                switch (node.type) {
                  case 'wallet':
                    return '#14f0b5';
                  case 'output':
                    return '#ff6b8a';
                  case 'trigger':
                    return '#10b981';
                  default:
                    return '#22d3ee';
                }
              }}
              maskColor="rgba(2, 10, 20, 0.8)"
              className="!bg-abyss !border-sea-mist/20 !rounded-lg"
            />
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="rgba(165, 216, 230, 0.15)"
            />
          </ReactFlow>

          {/* Node Configuration Sidebar */}
          {!showExecutionLogs && (
            <NodeConfigSidebar
              selectedNode={selectedNode}
              onClose={() => setSelectedNodeId(null)}
              onUpdateNode={handleUpdateNode}
              connectedInputs={connectedInputs}
            />
          )}

          {/* Execution Logs Sidebar */}
          <ExecutionLogsSidebar
            isExecuting={isExecuting}
            executionResult={executionResult}
            onClose={() => {
              setShowExecutionLogs(false);
              setExecutionResult(null);
            }}
          />
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-deep-ocean border border-sea-mist/20 rounded-xl p-6 w-full max-w-md"
          >
            <h3 className="text-xl font-bold text-foam-white mb-4">Save Workflow</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-sea-mist mb-2">Workflow Name</label>
                <input
                  type="text"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-abyss border border-sea-mist/20 text-foam-white focus:border-aqua-glow outline-none"
                  placeholder="My Workflow"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-sea-mist mb-2">Description (optional)</label>
                <textarea
                  value={workflowDescription}
                  onChange={(e) => setWorkflowDescription(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-abyss border border-sea-mist/20 text-foam-white focus:border-aqua-glow outline-none resize-none"
                  placeholder="Describe what this workflow does..."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-lg text-sea-mist hover:bg-sea-mist/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveWorkflow}
                disabled={!workflowName.trim() || isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-aqua-glow text-deep-ocean font-medium disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Workflow
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default function AgentEditor() {
  return (
    <ReactFlowProvider>
      <AgentEditorCanvas />
    </ReactFlowProvider>
  );
}
