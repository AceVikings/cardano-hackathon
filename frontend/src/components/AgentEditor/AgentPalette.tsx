import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, TrendingUp, TrendingDown, Send, Play, Bot, RefreshCw, ChevronDown, ChevronUp, Clock, Download, Webhook } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getAvailableAgents, getAvailableTriggers, type AvailableAgent, type AvailableTrigger } from '../../services/api';

interface AgentPaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: string, data: Record<string, unknown>) => void;
}

// Map backend icon names to Lucide icons
const iconMap: Record<string, LucideIcon> = {
  'play': Play,
  'clock': Clock,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'download': Download,
  'webhook': Webhook,
};

// Map backend color names to Tailwind gradients
const colorGradientMap: Record<string, string> = {
  'green': 'from-bioluminescent to-emerald-500',
  'violet': 'from-violet-500 to-purple-500',
  'blue': 'from-aqua-glow to-current-blue',
  'orange': 'from-coral to-orange-500',
  'emerald': 'from-emerald-500 to-teal-500',
  'purple': 'from-purple-500 to-indigo-500',
};

// Helper to get icon and gradient for an agent
const getAgentStyle = (agentName: string) => {
  const name = agentName.toLowerCase();
  if (name.includes('swap')) {
    return { icon: Zap, gradient: 'from-current-blue to-aqua-glow', agentType: 'swap' };
  }
  if (name.includes('transfer')) {
    return { icon: Send, gradient: 'from-aqua-glow to-seafoam', agentType: 'transfer' };
  }
  return { icon: Bot, gradient: 'from-bioluminescent to-emerald-500', agentType: 'custom' };
};

export default function AgentPalette({ onDragStart }: AgentPaletteProps) {
  const [availableAgents, setAvailableAgents] = useState<AvailableAgent[]>([]);
  const [availableTriggers, setAvailableTriggers] = useState<AvailableTrigger[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [loadingTriggers, setLoadingTriggers] = useState(true);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch agents
      try {
        const agents = await getAvailableAgents();
        setAvailableAgents(agents);
      } catch (err) {
        console.error('Failed to fetch available agents:', err);
      } finally {
        setLoadingAgents(false);
      }

      // Fetch triggers
      try {
        const triggers = await getAvailableTriggers();
        setAvailableTriggers(triggers);
      } catch (err) {
        console.error('Failed to fetch available triggers:', err);
      } finally {
        setLoadingTriggers(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="w-72 h-full overflow-y-auto p-4 border-r border-sea-mist/10">
      <h3 className="text-sm font-semibold text-foam-white mb-4">Triggers</h3>
      <p className="text-xs text-sea-mist/50 mb-3">Each workflow needs exactly one trigger</p>
      
      {/* Trigger Nodes */}
      <div className="space-y-2 mb-6">
        {loadingTriggers ? (
          <div className="flex items-center justify-center py-6">
            <RefreshCw className="w-5 h-5 text-bioluminescent animate-spin" />
          </div>
        ) : availableTriggers.length === 0 ? (
          <p className="text-xs text-sea-mist/50 py-4 text-center">No triggers available</p>
        ) : (
          availableTriggers.map((trigger) => {
            const Icon = iconMap[trigger.icon] || Play;
            const gradient = colorGradientMap[trigger.color] || 'from-gray-500 to-gray-600';
            return (
              <motion.div
                key={trigger.id}
                draggable
                onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, 'trigger', {
                  label: trigger.name,
                  triggerType: trigger.type,
                  configSchema: trigger.configSchema,
                })}
                className="flex items-center gap-3 p-3 rounded-lg bg-abyss/50 border border-sea-mist/10 cursor-grab hover:border-bioluminescent/30 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98, cursor: 'grabbing' }}
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-4 h-4 text-foam-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foam-white truncate">{trigger.name}</p>
                  <p className="text-xs text-sea-mist/50 truncate">{trigger.description}</p>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <h3 className="text-sm font-semibold text-foam-white mb-4">Available Agents</h3>
      
      {/* Agent Nodes from API */}
      <div className="space-y-2 mb-6">
        {loadingAgents ? (
          <div className="flex items-center justify-center py-6">
            <RefreshCw className="w-5 h-5 text-aqua-glow animate-spin" />
          </div>
        ) : availableAgents.length === 0 ? (
          <p className="text-xs text-sea-mist/50 py-4 text-center">No agents available</p>
        ) : (
          availableAgents.map((agent) => {
            const { icon: Icon, gradient, agentType } = getAgentStyle(agent.name);
            const isExpanded = expandedAgent === agent.name;
            
            return (
              <div key={agent.name} className="space-y-1">
                <motion.div
                  draggable
                  onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, 'agent', {
                    agentId: agent.id,
                    label: agent.name,
                    type: agentType,
                    status: 'configuring',
                    description: agent.description,
                    invokeUrl: agent.invokeUrl,
                    executionCost: agent.executionCost,
                    inputParameters: agent.inputParameters,
                    output: agent.output,
                    outputs: agent.outputs,
                  })}
                  className="flex items-center gap-3 p-3 rounded-lg bg-abyss/50 border border-sea-mist/10 cursor-grab hover:border-aqua-glow/30 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98, cursor: 'grabbing' }}
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-4 h-4 text-foam-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foam-white truncate">{agent.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-sea-mist/50 truncate flex-1">{agent.description}</p>
                      <span className="text-[10px] text-aqua-glow bg-aqua-glow/10 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                        {agent.executionCost}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedAgent(isExpanded ? null : agent.name);
                    }}
                    className="p-1 hover:bg-sea-mist/10 rounded transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-sea-mist/50" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-sea-mist/50" />
                    )}
                  </button>
                </motion.div>
                
                {/* Expanded details */}
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="ml-2 p-3 rounded-lg bg-abyss/30 border border-sea-mist/5 text-xs"
                  >
                    <p className="text-sea-mist/50 uppercase tracking-wider mb-2">Input Parameters</p>
                    <div className="space-y-1.5 mb-3">
                      {agent.inputParameters.map((param) => (
                        <div key={param.name} className="flex items-start gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-current-blue/20 text-aqua-glow font-mono">
                            {param.name}
                          </span>
                          <span className="text-sea-mist/40">{param.type}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-sea-mist/50 uppercase tracking-wider mb-2">Output</p>
                    <div className="flex items-start gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-bioluminescent/20 text-bioluminescent font-mono">
                        {agent.output.name}
                      </span>
                      <span className="text-sea-mist/40">{agent.output.type}</span>
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })
        )}
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
