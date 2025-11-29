import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Target } from 'lucide-react';

export interface OutputNodeData {
  label: string;
  outputType: 'defi' | 'swap' | 'stake' | 'custom';
}

const outputLabels = {
  defi: 'DeFi Protocol',
  swap: 'DEX Swap',
  stake: 'Staking Pool',
  custom: 'Custom Output',
};

function OutputNode({ data, selected }: NodeProps & { data: OutputNodeData }) {
  return (
    <div
      className={`
        relative min-w-[160px] rounded-xl transition-all duration-200
        ${selected 
          ? 'ring-2 ring-coral shadow-lg shadow-coral/30' 
          : 'ring-1 ring-coral/30'
        }
      `}
      style={{
        background: 'linear-gradient(135deg, rgba(255, 107, 138, 0.1) 0%, rgba(6, 20, 32, 0.95) 100%)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-coral !border-2 !border-deep-ocean"
      />

      {/* Node Content */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-coral to-orange-500 flex items-center justify-center">
            <Target className="w-5 h-5 text-foam-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-coral text-sm">{data.label}</h3>
            <span className="text-xs text-sea-mist/60">{outputLabels[data.outputType]}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(OutputNode);
