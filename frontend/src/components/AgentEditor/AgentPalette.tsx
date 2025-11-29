import { motion } from 'framer-motion';
import { Bot, Zap, TrendingUp, TrendingDown, Shield, Wallet, ArrowLeftRight, Target, Play } from 'lucide-react';

interface AgentPaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: string, data: Record<string, unknown>) => void;
}

const triggerTypes = [
  {
    type: 'trigger',
    triggerType: 'manual',
    label: 'Manual Trigger',
    description: 'Execute workflow manually',
    icon: Play,
    gradient: 'from-bioluminescent to-emerald-500',
  },
  {
    type: 'trigger',
    triggerType: 'price_gte',
    label: 'Price ≥ Target',
    description: 'Trigger when price rises',
    icon: TrendingUp,
    gradient: 'from-aqua-glow to-current-blue',
  },
  {
    type: 'trigger',
    triggerType: 'price_lte',
    label: 'Price ≤ Target',
    description: 'Trigger when price falls',
    icon: TrendingDown,
    gradient: 'from-coral to-orange-500',
  },
];

const agentTypes = [
  {
    type: 'agent',
    agentType: 'swap',
    label: 'Swap Agent',
    description: 'Execute token swaps on DEXes',
    icon: Zap,
    gradient: 'from-current-blue to-aqua-glow',
  },
  {
    type: 'agent',
    agentType: 'yield',
    label: 'Yield Agent',
    description: 'Optimize yield farming strategies',
    icon: TrendingUp,
    gradient: 'from-aqua-glow to-seafoam',
  },
  {
    type: 'agent',
    agentType: 'guard',
    label: 'Risk Guard',
    description: 'Monitor and protect positions',
    icon: Shield,
    gradient: 'from-bioluminescent to-emerald-500',
  },
  {
    type: 'agent',
    agentType: 'bridge',
    label: 'Bridge Agent',
    description: 'Cross-chain asset transfers',
    icon: ArrowLeftRight,
    gradient: 'from-coral to-orange-500',
  },
  {
    type: 'agent',
    agentType: 'custom',
    label: 'Custom Agent',
    description: 'Configure custom behavior',
    icon: Bot,
    gradient: 'from-sea-mist/50 to-current-blue/50',
  },
];

const specialNodes = [
  {
    type: 'wallet',
    label: 'Custodial Wallet',
    description: 'Your wallet funds source',
    icon: Wallet,
    gradient: 'from-bioluminescent to-emerald-600',
  },
  {
    type: 'output',
    label: 'Output Target',
    description: 'DeFi protocol destination',
    icon: Target,
    gradient: 'from-coral to-orange-500',
  },
];

export default function AgentPalette({ onDragStart }: AgentPaletteProps) {
  return (
    <div className="w-64 h-full overflow-y-auto p-4 border-r border-sea-mist/10">
      <h3 className="text-sm font-semibold text-foam-white mb-4">Triggers</h3>
      
      {/* Trigger Nodes */}
      <div className="space-y-2 mb-6">
        {triggerTypes.map((trigger) => {
          const Icon = trigger.icon;
          return (
            <motion.div
              key={trigger.triggerType}
              draggable
              onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, trigger.type, {
                label: trigger.label,
                triggerType: trigger.triggerType,
              })}
              className="flex items-center gap-3 p-3 rounded-lg bg-abyss/50 border border-sea-mist/10 cursor-grab hover:border-bioluminescent/30 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98, cursor: 'grabbing' }}
            >
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${trigger.gradient} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-4 h-4 text-foam-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foam-white truncate">{trigger.label}</p>
                <p className="text-xs text-sea-mist/50 truncate">{trigger.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <h3 className="text-sm font-semibold text-foam-white mb-4">Agents</h3>
      
      {/* Agent Nodes */}
      <div className="space-y-2 mb-6">
        {agentTypes.map((agent) => {
          const Icon = agent.icon;
          return (
            <motion.div
              key={agent.agentType}
              draggable
              onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, agent.type, {
                label: agent.label,
                type: agent.agentType,
                status: 'configuring',
                description: agent.description,
              })}
              className="flex items-center gap-3 p-3 rounded-lg bg-abyss/50 border border-sea-mist/10 cursor-grab hover:border-aqua-glow/30 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98, cursor: 'grabbing' }}
            >
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${agent.gradient} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-4 h-4 text-foam-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foam-white truncate">{agent.label}</p>
                <p className="text-xs text-sea-mist/50 truncate">{agent.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <h3 className="text-sm font-semibold text-foam-white mb-4">Special Nodes</h3>
      
      {/* Special Nodes */}
      <div className="space-y-2">
        {specialNodes.map((node) => {
          const Icon = node.icon;
          return (
            <motion.div
              key={node.type}
              draggable
              onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, node.type, {
                label: node.label,
                ...(node.type === 'output' ? { outputType: 'defi' } : {}),
              })}
              className="flex items-center gap-3 p-3 rounded-lg bg-abyss/50 border border-sea-mist/10 cursor-grab hover:border-aqua-glow/30 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98, cursor: 'grabbing' }}
            >
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${node.gradient} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-4 h-4 text-foam-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foam-white truncate">{node.label}</p>
                <p className="text-xs text-sea-mist/50 truncate">{node.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Instructions */}
      <div className="mt-6 p-3 rounded-lg bg-current-blue/10 border border-current-blue/20">
        <p className="text-xs text-sea-mist/70">
          <strong className="text-aqua-glow">Tip:</strong> Drag nodes to the canvas and connect them to create your agent workflow.
        </p>
      </div>
    </div>
  );
}
