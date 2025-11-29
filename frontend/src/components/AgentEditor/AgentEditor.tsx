import { useCallback, useRef } from 'react';
import type { DragEvent } from 'react';
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
import type { Connection, Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import AgentNode from './AgentNode';
import WalletNode from './WalletNode';
import OutputNode from './OutputNode';
import TriggerNode from './TriggerNode';
import AgentPalette from './AgentPalette';

// Custom node types
const nodeTypes = {
  agent: AgentNode,
  wallet: WalletNode,
  output: OutputNode,
  trigger: TriggerNode,
};

// Initial nodes with a manual trigger
const initialNodes: Node[] = [
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

const initialEdges: Edge[] = [];

let nodeId = 1;
const getId = () => `node_${nodeId++}`;

function AgentEditorCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();

  const onConnect = useCallback(
    (connection: Connection) => {
      // Create custom edge styling
      const edge: Edge = {
        ...connection,
        id: `edge-${connection.source}-${connection.target}`,
        type: 'smoothstep',
        animated: true,
        style: {
          stroke: '#22d3ee',
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
    [screenToFlowPosition, setNodes]
  );

  const onDragStart = (event: DragEvent, nodeType: string, data: Record<string, unknown>) => {
    event.dataTransfer.setData('application/reactflow-type', nodeType);
    event.dataTransfer.setData('application/reactflow-data', JSON.stringify(data));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex h-full">
      {/* Sidebar Palette */}
      <AgentPalette onDragStart={onDragStart} />

      {/* Flow Canvas */}
      <div ref={reactFlowWrapper} className="flex-1 h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
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
      </div>
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
