import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Play, TrendingUp, TrendingDown, Clock, Download, Webhook, Copy, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface TriggerNodeData {
  label: string;
  triggerType: 'manual' | 'price_gte' | 'price_lte' | 'cron' | 'schedule' | 'wallet_receive' | 'webhook';
  token?: string;
  targetPrice?: string;
  condition?: '>=' | '<=';
  cronExpression?: string;
  minAmount?: string;
  tokenFilter?: string;
  webhookUrl?: string;
}

interface TriggerConfigItem {
  icon: LucideIcon;
  gradient: string;
  description: string;
}

const triggerConfig: Record<string, TriggerConfigItem> = {
  manual: {
    icon: Play,
    gradient: 'from-bioluminescent to-emerald-500',
    description: 'Manually triggered',
  },
  cron: {
    icon: Clock,
    gradient: 'from-violet-500 to-purple-500',
    description: 'Runs on schedule',
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
  wallet_receive: {
    icon: Download,
    gradient: 'from-emerald-500 to-teal-500',
    description: 'Triggered on receiving tokens',
  },
  webhook: {
    icon: Webhook,
    gradient: 'from-purple-500 to-indigo-500',
    description: 'Triggered via HTTP webhook',
  },
};

function TriggerNode({ data, selected, id }: NodeProps & { data: TriggerNodeData }) {
  const [token, setToken] = useState(data.token || 'ADA');
  const [targetPrice, setTargetPrice] = useState(data.targetPrice || '');
  const [cronExpression, setCronExpression] = useState(data.cronExpression || '0 * * * *');
  const [minAmount, setMinAmount] = useState(data.minAmount || '');
  const [tokenFilter, setTokenFilter] = useState(data.tokenFilter || '');
  const [copied, setCopied] = useState(false);
  
  const config = triggerConfig[data.triggerType] || triggerConfig.manual;
  const Icon = config.icon;
  const isPriceTrigger = data.triggerType === 'price_gte' || data.triggerType === 'price_lte';
  const isCronTrigger = data.triggerType === 'cron';
  const isWalletReceiveTrigger = data.triggerType === 'wallet_receive';
  const isWebhookTrigger = data.triggerType === 'webhook';

  // Generate webhook URL based on node ID
  const webhookUrl = `${window.location.origin}/api/webhooks/trigger/${id}`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Common cron presets
  const cronPresets = [
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Daily at midnight', value: '0 0 * * *' },
    { label: 'Every Monday', value: '0 0 * * 1' },
  ];

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

        {isCronTrigger && (
          <div className="space-y-3">
            {/* Cron Preset */}
            <div>
              <label className="text-xs text-sea-mist/60 block mb-1">Schedule Preset</label>
              <select
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-abyss/50 border border-sea-mist/20 text-foam-white text-xs focus:outline-none focus:border-aqua-glow"
              >
                {cronPresets.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Custom Cron Expression */}
            <div>
              <label className="text-xs text-sea-mist/60 block mb-1">
                Cron Expression
              </label>
              <input
                type="text"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                placeholder="0 * * * *"
                className="w-full px-2 py-1.5 rounded-lg bg-abyss/50 border border-sea-mist/20 text-foam-white text-xs font-mono focus:outline-none focus:border-aqua-glow"
              />
              <p className="text-[10px] text-sea-mist/40 mt-1">
                Format: min hour day month weekday
              </p>
            </div>
          </div>
        )}

        {isWalletReceiveTrigger && (
          <div className="space-y-3">
            {/* Minimum Amount */}
            <div>
              <label className="text-xs text-sea-mist/60 block mb-1">
                Minimum Amount (optional)
              </label>
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="Any amount"
                step="0.01"
                className="w-full px-2 py-1.5 rounded-lg bg-abyss/50 border border-sea-mist/20 text-foam-white text-xs focus:outline-none focus:border-aqua-glow"
              />
            </div>
            
            {/* Token Filter */}
            <div>
              <label className="text-xs text-sea-mist/60 block mb-1">
                Token Filter (optional)
              </label>
              <select
                value={tokenFilter}
                onChange={(e) => setTokenFilter(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-abyss/50 border border-sea-mist/20 text-foam-white text-xs focus:outline-none focus:border-aqua-glow"
              >
                <option value="">Any token</option>
                <option value="ADA">ADA</option>
                <option value="MIN">MIN</option>
                <option value="SUNDAE">SUNDAE</option>
                <option value="SNEK">SNEK</option>
              </select>
              <p className="text-[10px] text-sea-mist/40 mt-1">
                Leave empty to trigger on any received token
              </p>
            </div>
          </div>
        )}

        {isWebhookTrigger && (
          <div className="space-y-3">
            {/* Webhook URL */}
            <div>
              <label className="text-xs text-sea-mist/60 block mb-1">
                Webhook URL
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={webhookUrl}
                  readOnly
                  className="flex-1 px-2 py-1.5 rounded-lg bg-abyss/50 border border-sea-mist/20 text-foam-white text-[10px] font-mono focus:outline-none"
                />
                <button
                  onClick={copyWebhookUrl}
                  className="p-1.5 rounded-lg bg-abyss/50 border border-sea-mist/20 text-sea-mist hover:text-aqua-glow hover:border-aqua-glow/30 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-bioluminescent" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-sea-mist/40 mt-1">
                POST to this URL to trigger the workflow
              </p>
            </div>
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
