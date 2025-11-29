import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Zap, Send, Play, ChevronDown } from 'lucide-react';

export interface AgentNodeData {
  label: string;
  type: 'swap' | 'transfer';
  status: 'active' | 'inactive' | 'configuring';
  description?: string;
  inputParameters?: Array<{ name: string; type: string; description: string }>;
  output?: { name: string; type: string; description: string };
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
  data: '!w-3 !h-3 !bg-aqua-glow !border-2 !border-deep-ocean',
};

function AgentNode({ data, selected }: NodeProps & { data: AgentNodeData }) {
  const Icon = iconMap[data.type] || Zap;
  const gradient = gradientMap[data.type] || gradientMap.swap;
  const statusColor = statusColors[data.status];

  return (
    <div
      className={`
        relative min-w-[200px] rounded-xl transition-all duration-200
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

      {/* Data Input Handle (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        id="data-in"
        className={handleStyles.data}
      />

      {/* Node Content */}
      <div className="p-4">
        {/* Trigger Input Label */}
        <div className="absolute -top-5 left-1/2 -translate-x-1/2">
          <span className="text-[10px] text-bioluminescent/70 flex items-center gap-0.5">
            <Play className="w-2.5 h-2.5" /> trigger
          </span>
        </div>

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
            </div>
          </div>
        </div>

        {/* Description */}
        {data.description && (
          <p className="text-xs text-sea-mist/50 line-clamp-2 mb-2">{data.description}</p>
        )}

        {/* Input/Output Labels */}
        <div className="flex justify-between text-[10px] text-sea-mist/50 mt-2">
          <span className="flex items-center gap-0.5">
            <ChevronDown className="w-2.5 h-2.5 -rotate-90" /> input
          </span>
          <span className="flex items-center gap-0.5">
            output <ChevronDown className="w-2.5 h-2.5 rotate-90" />
          </span>
        </div>

        {/* Trigger Output Label */}
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
          <span className="text-[10px] text-bioluminescent/70 flex items-center gap-0.5">
            <Play className="w-2.5 h-2.5" /> next
          </span>
        </div>
      </div>

      {/* Data Output Handle (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="data-out"
        className={handleStyles.data}
      />

      {/* Trigger Output Handle (Bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="trigger-out"
        className={handleStyles.trigger}
        style={{ bottom: -6 }}
      />
    </div>
  );
}

export default memo(AgentNode);
