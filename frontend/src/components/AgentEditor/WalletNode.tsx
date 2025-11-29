import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Wallet } from 'lucide-react';

export interface WalletNodeData {
  label: string;
  address?: string;
  balance?: string;
}

function WalletNode({ data, selected }: NodeProps & { data: WalletNodeData }) {
  return (
    <div
      className={`
        relative min-w-[200px] rounded-xl transition-all duration-200
        ${selected 
          ? 'ring-2 ring-bioluminescent shadow-lg shadow-bioluminescent/30' 
          : 'ring-1 ring-bioluminescent/30'
        }
      `}
      style={{
        background: 'linear-gradient(135deg, rgba(20, 240, 181, 0.1) 0%, rgba(6, 20, 32, 0.95) 100%)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Node Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-bioluminescent to-emerald-600 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-deep-ocean" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-bioluminescent text-sm">{data.label}</h3>
            <span className="text-xs text-sea-mist/60">Custodial Wallet</span>
          </div>
        </div>

        {/* Wallet Info */}
        {data.address && (
          <div className="mt-2 p-2 rounded-lg bg-deep-ocean/50">
            <p className="text-xs text-sea-mist/50 mb-1">Address</p>
            <p className="text-xs font-mono text-aqua-glow truncate">{data.address}</p>
          </div>
        )}
        
        {data.balance && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-sea-mist/50">Balance</span>
            <span className="text-sm font-semibold text-foam-white">{data.balance}</span>
          </div>
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

export default memo(WalletNode);
