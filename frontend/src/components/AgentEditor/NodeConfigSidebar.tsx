import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Info, Zap, Send, Clock, AlertCircle } from 'lucide-react';
import type { Node } from '@xyflow/react';
import type { AgentNodeData } from './AgentNode';

interface InputValue {
  name: string;
  value: string;
  type: string;
  description: string;
  source: 'manual' | 'connection'; // Whether value is manually entered or from a connection
}

interface NodeConfigSidebarProps {
  selectedNode: Node | null;
  onClose: () => void;
  onUpdateNode: (nodeId: string, data: Partial<AgentNodeData & { inputValues?: Record<string, InputValue> }>) => void;
  connectedInputs: string[]; // List of input names that have incoming connections
}

const iconMap: Record<string, typeof Zap> = {
  swap: Zap,
  transfer: Send,
};

const gradientMap: Record<string, string> = {
  swap: 'from-current-blue to-aqua-glow',
  transfer: 'from-aqua-glow to-seafoam',
};

export default function NodeConfigSidebar({ 
  selectedNode, 
  onClose, 
  onUpdateNode,
  connectedInputs 
}: NodeConfigSidebarProps) {
  const [inputValues, setInputValues] = useState<Record<string, InputValue>>({});
  
  // Initialize input values when node changes
  useEffect(() => {
    if (selectedNode && selectedNode.type === 'agent') {
      const data = selectedNode.data as unknown as AgentNodeData;
      const existingValues = (data as AgentNodeData & { inputValues?: Record<string, InputValue> }).inputValues || {};
      
      // Initialize values for all input parameters
      const initialValues: Record<string, InputValue> = {};
      (data.inputParameters || []).forEach((param) => {
        const isConnected = connectedInputs.includes(param.name);
        initialValues[param.name] = existingValues[param.name] || {
          name: param.name,
          value: '',
          type: param.type,
          description: param.description,
          source: isConnected ? 'connection' : 'manual',
        };
        // Update source if connection status changed
        if (isConnected) {
          initialValues[param.name].source = 'connection';
        }
      });
      
      setInputValues(initialValues);
    }
  }, [selectedNode, connectedInputs]);

  // Save values when they change
  const handleValueChange = (paramName: string, value: string) => {
    const newValues = {
      ...inputValues,
      [paramName]: {
        ...inputValues[paramName],
        value,
        source: 'manual' as const,
      },
    };
    setInputValues(newValues);
    
    if (selectedNode) {
      onUpdateNode(selectedNode.id, { inputValues: newValues });
    }
  };

  if (!selectedNode || selectedNode.type !== 'agent') {
    return null;
  }

  const data = selectedNode.data as unknown as AgentNodeData;
  const Icon = iconMap[data.type] || Zap;
  const gradient = gradientMap[data.type] || gradientMap.swap;
  const inputs = data.inputParameters || [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 320, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute right-0 top-0 bottom-0 w-80 bg-deep-ocean/95 backdrop-blur-xl border-l border-sea-mist/10 shadow-xl shadow-black/20 z-20 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sea-mist/10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <Icon className="w-5 h-5 text-foam-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foam-white text-sm">{data.label}</h3>
              <span className="text-xs text-sea-mist/60 flex items-center gap-1">
                <Settings className="w-3 h-3" />
                Configure Agent
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-sea-mist/10 text-sea-mist/60 hover:text-foam-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        {data.description && (
          <div className="px-4 py-3 border-b border-sea-mist/5 bg-current-blue/5">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-aqua-glow mt-0.5 flex-shrink-0" />
              <p className="text-xs text-sea-mist/70 leading-relaxed">{data.description}</p>
            </div>
          </div>
        )}

        {/* Input Configuration */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider text-sea-mist/50 font-medium flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              Input Parameters
            </h4>

            {inputs.length === 0 ? (
              <div className="text-center py-8 text-sea-mist/40">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No input parameters</p>
              </div>
            ) : (
              <div className="space-y-4">
                {inputs.map((param) => {
                  const inputValue = inputValues[param.name];
                  const isConnected = connectedInputs.includes(param.name);
                  
                  return (
                    <div key={param.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-foam-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-aqua-glow/60" />
                          {param.name}
                        </label>
                        <span className="text-[10px] text-sea-mist/40 font-mono bg-sea-mist/10 px-2 py-0.5 rounded">
                          {param.type}
                        </span>
                      </div>
                      
                      {param.description && (
                        <p className="text-[11px] text-sea-mist/50 leading-relaxed">
                          {param.description}
                        </p>
                      )}

                      {isConnected ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-bioluminescent/10 border border-bioluminescent/30">
                          <div className="w-2 h-2 rounded-full bg-bioluminescent animate-pulse" />
                          <span className="text-sm text-bioluminescent">Connected from previous node</span>
                        </div>
                      ) : (
                        <div className="relative">
                          {renderInputField(param, inputValue?.value || '', handleValueChange)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Output Info */}
          {data.output && (
            <div className="mt-6 pt-4 border-t border-sea-mist/10">
              <h4 className="text-xs uppercase tracking-wider text-sea-mist/50 font-medium flex items-center gap-2 mb-3">
                <Send className="w-3.5 h-3.5" />
                Output
              </h4>
              <div className="flex items-center justify-between p-3 rounded-lg bg-coral/10 border border-coral/20">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-coral/60" />
                  <span className="text-sm font-medium text-foam-white">{data.output.name}</span>
                </div>
                <span className="text-[10px] text-sea-mist/40 font-mono bg-sea-mist/10 px-2 py-0.5 rounded">
                  {data.output.type}
                </span>
              </div>
              {data.output.description && (
                <p className="mt-2 text-[11px] text-sea-mist/50 leading-relaxed">
                  {data.output.description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-sea-mist/10 bg-abyss/50">
          <div className="flex items-center gap-2 text-[11px] text-sea-mist/40">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Values are saved automatically</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Helper function to render appropriate input field based on type
function renderInputField(
  param: { name: string; type: string; description: string },
  value: string,
  onChange: (name: string, value: string) => void
) {
  const baseInputClass = "w-full px-3 py-2.5 rounded-lg bg-abyss/80 border border-sea-mist/20 text-foam-white text-sm focus:border-aqua-glow focus:ring-1 focus:ring-aqua-glow/30 outline-none transition-all placeholder:text-sea-mist/30";
  
  switch (param.type.toLowerCase()) {
    case 'number':
    case 'amount':
    case 'lovelace':
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(param.name, e.target.value)}
          placeholder={`Enter ${param.name.toLowerCase()}...`}
          className={baseInputClass}
          step="any"
        />
      );

    case 'address':
    case 'string':
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(param.name, e.target.value)}
          placeholder={`Enter ${param.name.toLowerCase()}...`}
          className={baseInputClass}
        />
      );

    case 'boolean':
      return (
        <div className="flex items-center gap-3">
          <button
            onClick={() => onChange(param.name, 'true')}
            className={`flex-1 py-2.5 rounded-lg border transition-all text-sm font-medium ${
              value === 'true'
                ? 'bg-bioluminescent/20 border-bioluminescent text-bioluminescent'
                : 'bg-abyss/80 border-sea-mist/20 text-sea-mist/60 hover:border-sea-mist/40'
            }`}
          >
            True
          </button>
          <button
            onClick={() => onChange(param.name, 'false')}
            className={`flex-1 py-2.5 rounded-lg border transition-all text-sm font-medium ${
              value === 'false'
                ? 'bg-coral/20 border-coral text-coral'
                : 'bg-abyss/80 border-sea-mist/20 text-sea-mist/60 hover:border-sea-mist/40'
            }`}
          >
            False
          </button>
        </div>
      );

    case 'select':
    case 'token':
    case 'asset':
      // For token/asset selection, we'd ideally fetch available tokens
      // For now, provide a text input with autocomplete potential
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(param.name, e.target.value)}
          placeholder={`Select or enter ${param.name.toLowerCase()}...`}
          className={baseInputClass}
          list={`${param.name}-options`}
        />
      );

    case 'json':
    case 'object':
      return (
        <textarea
          value={value}
          onChange={(e) => onChange(param.name, e.target.value)}
          placeholder={`Enter JSON for ${param.name.toLowerCase()}...`}
          className={`${baseInputClass} min-h-[80px] font-mono text-xs resize-y`}
          rows={3}
        />
      );

    default:
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(param.name, e.target.value)}
          placeholder={`Enter ${param.name.toLowerCase()}...`}
          className={baseInputClass}
        />
      );
  }
}
