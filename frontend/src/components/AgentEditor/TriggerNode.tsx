import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Play, TrendingUp, TrendingDown, Clock } from 'lucide-react';

export interface TriggerNodeData {
  label: string;
  triggerType: 'manual' | 'price_gte' | 'price_lte' | 'schedule';
  token?: string;
  targetPrice?: string;
  condition?: '>=' | '<=';
}

const triggerConfig = {
  manual: {
    icon: Play,
    gradient: 'from-bioluminescent to-emerald-500',
    description: 'Manually triggered',
  },
  price_gte: {
    icon: TrendingUp,
    gradient: 'from-aqua-glow to-current-blue',
    description: 'Price ≥ target',
  },
  price_lte: {
    icon: TrendingDown,
    gradient: 'from-coral to-orange-500',
    description: 'Price ≤ target',
  },
  schedule: {
    icon: Clock,
    gradient: 'from-purple-500 to-current-blue',
    description: 'Scheduled',
  },
};

function TriggerNode({ data, selected }: NodeProps & { data: TriggerNodeData }) {
  const [token, setToken] = useState(data.token || 'ADA');
  const [targetPrice, setTargetPrice] = useState(data.targetPrice || '');
  
  const config = triggerConfig[data.triggerType] || triggerConfig.manual;
  const Icon = config.icon;
  const isPriceTrigger = data.triggerType === 'price_gte' || data.triggerType === 'price_lte';

  return (
    <div
      className={`
        relative min-w-[200px] rounded-xl transition-all duration-200
        ${selected 
          ? 'ring-2 ring-bioluminescent shadow-lg shadow-bioluminescent/30' 
          : 'ring-1 ring-sea-mist/20'
        }
      `}
      style={{
        background: 'linear-gradient(135deg, rgba(2, 10, 20, 0.95), rgba(10, 30, 50, 0.9))',
      }}
    >
      {/* Header */}
      <div className={`px-4 py-3 rounded-t-xl bg-gradient-to-r ${config.gradient}`}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-foam-white" />
          <span className="text-sm font-semibold text-foam-white">{data.label}</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="text-xs text-sea-mist/60 mb-3">{config.description}</p>
        
        {isPriceTrigger && (
          <div className="space-y-3">
            {/* Token Select */}
            <div>
              <label className="text-xs text-sea-mist/60 block mb-1">Token</label>
              <select
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-abyss/50 border border-sea-mist/20 text-foam-white text-xs focus:outline-none focus:border-aqua-glow"
              >
                <option value="ADA">ADA</option>
                <option value="MIN">MIN</option>
                <option value="SUNDAE">SUNDAE</option>
                <option value="SNEK">SNEK</option>
                <option value="WMT">WMT</option>
              </select>
            </div>
            
            {/* Target Price */}
            <div>
              <label className="text-xs text-sea-mist/60 block mb-1">
                Target Price (USD)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-sea-mist">
                  {data.triggerType === 'price_gte' ? '≥' : '≤'}
                </span>
                <input
                  type="number"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="flex-1 px-2 py-1.5 rounded-lg bg-abyss/50 border border-sea-mist/20 text-foam-white text-xs focus:outline-none focus:border-aqua-glow"
                />
              </div>
            </div>
          </div>
        )}

        {data.triggerType === 'manual' && (
          <div className="text-center py-2">
            <button className="px-3 py-1.5 rounded-lg bg-bioluminescent/20 border border-bioluminescent/40 text-bioluminescent text-xs hover:bg-bioluminescent/30 transition-colors">
              Click to Execute
            </button>
          </div>
        )}
      </div>

      {/* Trigger Output Handle (Bottom) - connects to agent trigger-in */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="trigger-out"
        className="!w-3 !h-3 !bg-bioluminescent !border-2 !border-foam-white"
        style={{ bottom: -6 }}
      />

      {/* Label for trigger output */}
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
        <span className="text-[10px] text-bioluminescent/70 flex items-center gap-0.5">
          <Play className="w-2.5 h-2.5" /> trigger
        </span>
      </div>
    </div>
  );
}

export default memo(TriggerNode);
