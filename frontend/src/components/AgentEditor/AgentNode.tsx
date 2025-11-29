import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Zap, Send } from 'lucide-react';

export interface AgentNodeData {
  label: string;
  type: 'swap' | 'transfer';
  status: 'active' | 'inactive' | 'configuring';
  description?: string;
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

function AgentNode({ data, selected }: NodeProps & { data: AgentNodeData }) {
  const Icon = iconMap[data.type] || Zap;
  const gradient = gradientMap[data.type] || gradientMap.swap;
  const statusColor = statusColors[data.status];

  return (
    <div
      className={`
        relative min-w-[180px] rounded-xl transition-all duration-200
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
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-aqua-glow !border-2 !border-deep-ocean"
      />

      {/* Node Content */}
      <div className="p-4">
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
          <p className="text-xs text-sea-mist/50 line-clamp-2">{data.description}</p>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-bioluminescent !border-2 !border-deep-ocean"
      />
    </div>
  );
}

export default memo(AgentNode);
