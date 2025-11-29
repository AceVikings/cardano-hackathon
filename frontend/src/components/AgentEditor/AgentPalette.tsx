import { motion } from 'framer-motion';
import { Zap, TrendingUp, TrendingDown, Send, Play } from 'lucide-react';

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
    agentType: 'transfer',
    label: 'Transfer Agent',
    description: 'Send tokens to an address',
    icon: Send,
    gradient: 'from-aqua-glow to-seafoam',
  },
];

export default function AgentPalette({ onDragStart }: AgentPaletteProps) {
  return (
    <div className="w-64 h-full overflow-y-auto p-4 border-r border-sea-mist/10">
      <h3 className="text-sm font-semibold text-foam-white mb-4">Triggers</h3>
      <p className="text-xs text-sea-mist/50 mb-3">Each workflow needs exactly one trigger</p>
      
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

      {/* Instructions */}
      <div className="mt-6 p-3 rounded-lg bg-current-blue/10 border border-current-blue/20">
        <p className="text-xs text-sea-mist/70">
          <strong className="text-aqua-glow">Tip:</strong> Drag a trigger and agents to the canvas, then connect them to create your workflow.
        </p>
      </div>
    </div>
  );
}
