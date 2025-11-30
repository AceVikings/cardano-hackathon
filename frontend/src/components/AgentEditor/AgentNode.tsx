import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Zap, Send, Play } from 'lucide-react';

export interface AgentNodeData {
  agentId?: string;
  label: string;
  type: 'swap' | 'transfer' | 'custom';
  status: 'active' | 'inactive' | 'configuring';
  description?: string;
  invokeUrl?: string;
  executionCost?: string;
  inputParameters?: Array<{ name: string; type: string; description: string }>;
  output?: { name: string; type: string; description: string }; // Legacy single output
  outputs?: Array<{ name: string; type: string; description: string }>; // Multiple outputs
  inputValues?: Record<string, { value: string; source: 'manual' | 'connection' }>;
}

const iconMap: Record<string, typeof Zap> = {
  swap: Zap,
  transfer: Send,
};

const gradientMap: Record<string, string> = {
  swap: 'from-current-blue to-aqua-glow',
  transfer: 'from-aqua-glow to-seafoam',
};

const statusColors = {
  active: 'bg-bioluminescent',
  inactive: 'bg-sea-mist/30',
  configuring: 'bg-coral animate-pulse',
};

// Custom handle styles for different connection types
const handleStyles = {
  trigger: '!w-3 !h-3 !bg-bioluminescent !border-2 !border-deep-ocean',
  input: '!w-2.5 !h-2.5 !bg-aqua-glow !border-2 !border-deep-ocean',
  output: '!w-2.5 !h-2.5 !bg-coral !border-2 !border-deep-ocean',
};

function AgentNode({ data, selected }: NodeProps & { data: AgentNodeData }) {
  const Icon = iconMap[data.type] || Zap;
  const gradient = gradientMap[data.type] || gradientMap.swap;
  const statusColor = statusColors[data.status];
  
  const inputs = data.inputParameters || [];
  // Support both single output and multiple outputs
  const outputs = data.outputs || (data.output ? [data.output] : []);
  
  // Calculate node height based on number of inputs/outputs
  const handleCount = Math.max(inputs.length, outputs.length);
  const handleSpacing = 28; // pixels between handles
  const minContentHeight = 80;
  const calculatedHeight = Math.max(minContentHeight, handleCount * handleSpacing + 40);

  return (
    <div
      className={`
        relative min-w-[220px] rounded-xl transition-all duration-200
        ${selected 
          ? 'ring-2 ring-aqua-glow shadow-lg shadow-aqua-glow/30' 
          : 'ring-1 ring-sea-mist/20'
        }
      `}
      style={{
        background: 'linear-gradient(135deg, rgba(6, 20, 32, 0.95) 0%, rgba(8, 145, 178, 0.15) 100%)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Trigger Input Handle (Top) */}
      <Handle
        type="target"
        position={Position.Top}
        id="trigger-in"
        className={handleStyles.trigger}
        style={{ top: -6 }}
      />

      {/* Trigger Input Label */}
      <div className="absolute -top-5 left-1/2 -translate-x-1/2">
        <span className="text-[10px] text-bioluminescent/70 flex items-center gap-0.5">
          <Play className="w-2.5 h-2.5" /> trigger
        </span>
      </div>

      {/* Node Content */}
      <div className="p-4" style={{ minHeight: calculatedHeight }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-foam-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foam-white text-sm truncate">{data.label}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${statusColor}`} />
              <span className="text-xs text-sea-mist/60 capitalize">{data.status}</span>
              {data.executionCost && (
                <span className="text-[9px] text-aqua-glow bg-aqua-glow/10 px-1 py-0.5 rounded font-mono ml-1">
                  {data.executionCost}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {data.description && (
          <p className="text-xs text-sea-mist/50 line-clamp-2 mb-3">{data.description}</p>
        )}

        {/* Input/Output Section */}
        <div className="flex justify-between gap-4 mt-2">
          {/* Input Labels (Left side) */}
          <div className="flex flex-col gap-1">
            {inputs.length > 0 && (
              <span className="text-[9px] text-sea-mist/40 uppercase tracking-wider mb-1">Inputs</span>
            )}
            {inputs.map((param, index) => (
              <div 
                key={param.name} 
                className="flex items-center gap-1.5"
                style={{ height: handleSpacing - 4, marginTop: index === 0 ? 0 : 4 }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-aqua-glow/60" />
                <span className="text-[10px] text-aqua-glow/80 font-mono">{param.name}</span>
                <span className="text-[9px] text-sea-mist/40">({param.type})</span>
              </div>
            ))}
          </div>

          {/* Output Labels (Right side) */}
          <div className="flex flex-col gap-1 items-end">
            {outputs.length > 0 && (
              <span className="text-[9px] text-sea-mist/40 uppercase tracking-wider mb-1">Outputs</span>
            )}
            {outputs.map((output, index) => (
              <div 
                key={output.name}
                className="flex items-center gap-1.5"
                style={{ height: handleSpacing - 4, marginTop: index === 0 ? 0 : 4 }}
              >
                <span className="text-[9px] text-sea-mist/40">({output.type})</span>
                <span className="text-[10px] text-coral/80 font-mono">{output.name}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-coral/60" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dynamic Input Handles (Left side) */}
      {inputs.map((param, index) => {
        // Calculate vertical position for each input handle
        // Start after header (~70px) and space evenly
        const topOffset = 95 + (index * handleSpacing);
        return (
          <Handle
            key={`input-${param.name}`}
            type="target"
            position={Position.Left}
            id={`input-${param.name}`}
            className={handleStyles.input}
            style={{ top: topOffset }}
          />
        );
      })}

      {/* Dynamic Output Handles (Right side) */}
      {outputs.map((output, index) => {
        // Calculate vertical position for each output handle
        const topOffset = 95 + (index * handleSpacing);
        return (
          <Handle
            key={`output-${output.name}`}
            type="source"
            position={Position.Right}
            id={`output-${output.name}`}
            className={handleStyles.output}
            style={{ top: topOffset }}
          />
        );
      })}

      {/* Trigger Output Handle (Bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="trigger-out"
        className={handleStyles.trigger}
        style={{ bottom: -6 }}
      />

      {/* Trigger Output Label */}
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
        <span className="text-[10px] text-bioluminescent/70 flex items-center gap-0.5">
          <Play className="w-2.5 h-2.5" /> next
        </span>
      </div>
    </div>
  );
}

export default memo(AgentNode);
