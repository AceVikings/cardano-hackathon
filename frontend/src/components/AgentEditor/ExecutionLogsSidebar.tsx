import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useState, useEffect } from "react";
import type { ExecutionResult, LiveExecution } from "../../services/api";
import { getLiveExecutionStatus } from "../../services/api";

interface ExecutionLogsSidebarProps {
  isExecuting: boolean;
  executionResult: ExecutionResult | null;
  executionId?: string | null;
  onClose: () => void;
}

export default function ExecutionLogsSidebar({
  isExecuting,
  executionResult,
  executionId,
  onClose,
}: ExecutionLogsSidebarProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [liveExecution, setLiveExecution] = useState<LiveExecution | null>(null);

  // Poll for live execution status while executing
  useEffect(() => {
    if (!isExecuting || !executionId) {
      setLiveExecution(null);
      return;
    }

    let isCancelled = false;
    
    const pollLiveStatus = async () => {
      try {
        const status = await getLiveExecutionStatus(executionId);
        if (!isCancelled && status) {
          setLiveExecution(status);
        }
      } catch (error) {
        console.error("Failed to poll live status:", error);
      }
    };

    // Poll immediately, then every 1.5 seconds
    pollLiveStatus();
    const interval = setInterval(pollLiveStatus, 1500);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [isExecuting, executionId]);

  const toggleExpanded = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-coral" />;
      case "partial":
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-aqua-glow animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-sea-mist/40" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-emerald-500/20 text-emerald-400";
      case "failed":
        return "bg-coral/20 text-coral";
      case "partial":
        return "bg-amber-500/20 text-amber-400";
      case "running":
        return "bg-aqua-glow/20 text-aqua-glow";
      default:
        return "bg-sea-mist/10 text-sea-mist/60";
    }
  };

  // Show sidebar only when executing or when there's a result
  if (!isExecuting && !executionResult) {
    return null;
  }

  // Determine what data to display - prefer final result, otherwise use live data
  const nodeResults = liveExecution?.nodeResults || [];
  const currentNode = liveExecution?.currentNode;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 320, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="absolute right-0 top-0 bottom-0 w-80 bg-deep-ocean/95 backdrop-blur-xl border-l border-sea-mist/10 shadow-xl shadow-black/20 z-20 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sea-mist/10">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isExecuting && !executionResult
                  ? "bg-aqua-glow/20"
                  : executionResult?.status === "success"
                  ? "bg-emerald-500/20"
                  : executionResult?.status === "failed"
                  ? "bg-coral/20"
                  : "bg-amber-500/20"
              }`}
            >
              {isExecuting && !executionResult ? (
                <Loader2 className="w-4 h-4 text-aqua-glow animate-spin" />
              ) : (
                <Play
                  className={`w-4 h-4 ${
                    executionResult?.status === "success"
                      ? "text-emerald-400"
                      : executionResult?.status === "failed"
                      ? "text-coral"
                      : "text-amber-400"
                  }`}
                />
              )}
            </div>
            <div>
              <h3 className="text-foam-white font-semibold text-sm">
                {isExecuting && !executionResult ? "Executing..." : "Execution Complete"}
              </h3>
              {executionResult && (
                <p className="text-xs text-sea-mist/60">
                  {executionResult.summary.successfulNodes}/
                  {executionResult.summary.totalNodes} nodes
                </p>
              )}
              {isExecuting && !executionResult && liveExecution?.totalNodes && (
                <p className="text-xs text-sea-mist/60">
                  {nodeResults.filter(n => n.status === 'success').length}/
                  {liveExecution.totalNodes} nodes
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-sea-mist/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-sea-mist/60" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Live Execution View */}
          {isExecuting && !executionResult && (
            <div className="space-y-4">
              {/* Overall Status */}
              <div className={`rounded-xl p-4 ${getStatusColor('running')}`}>
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="font-medium">Running Workflow</span>
                </div>
                {liveExecution?.workflowName && (
                  <p className="text-xs mt-1 opacity-80">
                    {liveExecution.workflowName}
                  </p>
                )}
              </div>

              {/* Live Node Results */}
              {nodeResults.length > 0 ? (
                <div>
                  <h4 className="text-xs font-semibold text-sea-mist/60 uppercase tracking-wider mb-3">
                    Live Agent Logs
                  </h4>
                  <div className="space-y-2">
                    {nodeResults.map((nodeResult) => (
                      <div
                        key={nodeResult.nodeId}
                        className={`bg-sea-mist/5 rounded-xl overflow-hidden ${
                          currentNode === nodeResult.nodeId ? 'ring-1 ring-aqua-glow/50' : ''
                        }`}
                      >
                        {/* Node Header */}
                        <button
                          onClick={() => toggleExpanded(nodeResult.nodeId)}
                          className="w-full flex items-center justify-between p-3 hover:bg-sea-mist/5 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                nodeResult.status === "success"
                                  ? "bg-emerald-400"
                                  : nodeResult.status === "failed"
                                  ? "bg-coral"
                                  : nodeResult.status === "running"
                                  ? "bg-aqua-glow animate-pulse"
                                  : "bg-sea-mist/40"
                              }`}
                            />
                            <span className="text-sm font-medium text-foam-white">
                              {nodeResult.label || nodeResult.agentId || nodeResult.nodeId}
                            </span>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${getStatusColor(
                                nodeResult.status
                              )}`}
                            >
                              {nodeResult.status}
                            </span>
                          </div>
                          {nodeResult.status === 'running' ? (
                            <Loader2 className="w-4 h-4 text-aqua-glow animate-spin" />
                          ) : expandedNodes.has(nodeResult.nodeId) ? (
                            <ChevronDown className="w-4 h-4 text-sea-mist/40" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-sea-mist/40" />
                          )}
                        </button>

                        {/* Node Details */}
                        <AnimatePresence>
                          {expandedNodes.has(nodeResult.nodeId) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-sea-mist/10"
                            >
                              <div className="p-3 space-y-3">
                                {/* Timing */}
                                {nodeResult.duration && (
                                  <div className="flex justify-between text-xs">
                                    <span className="text-sea-mist/40">Duration</span>
                                    <span className="text-sea-mist/80">
                                      {nodeResult.duration}ms
                                    </span>
                                  </div>
                                )}

                                {/* Output */}
                                {nodeResult.output &&
                                  Object.keys(nodeResult.output).length > 0 && (
                                    <div>
                                      <p className="text-xs text-sea-mist/40 mb-1">Output</p>
                                      <div className="bg-abyss/50 rounded-lg p-2">
                                        <pre className="text-xs text-emerald-400/80 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                                          {JSON.stringify(nodeResult.output, null, 2)}
                                        </pre>
                                      </div>
                                    </div>
                                  )}

                                {/* Error */}
                                {nodeResult.error && (
                                  <div>
                                    <p className="text-xs text-sea-mist/40 mb-1">Error</p>
                                    <div className="bg-coral/10 rounded-lg p-2">
                                      <pre className="text-xs text-coral overflow-x-auto whitespace-pre-wrap">
                                        {nodeResult.error}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-aqua-glow/30 animate-pulse" />
                    <Loader2 className="w-6 h-6 text-aqua-glow animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-sea-mist mt-3 text-sm">Starting workflow...</p>
                  <p className="text-sea-mist/50 mt-1 text-xs">
                    Waiting for agent execution
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Final Execution Result */}
          {executionResult && (
            <div className="space-y-4">
              {/* Overall Status */}
              <div
                className={`rounded-xl p-4 ${getStatusColor(
                  executionResult.status
                )}`}
              >
                <div className="flex items-center gap-2">
                  {getStatusIcon(executionResult.status)}
                  <span className="font-medium capitalize">
                    {executionResult.status}
                  </span>
                </div>
                <p className="text-xs mt-1 opacity-80">
                  Duration: {executionResult.timing.duration}ms
                </p>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-sea-mist/5 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-foam-white">
                    {executionResult.summary.totalNodes}
                  </p>
                  <p className="text-xs text-sea-mist/60">Total</p>
                </div>
                <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-emerald-400">
                    {executionResult.summary.successfulNodes}
                  </p>
                  <p className="text-xs text-sea-mist/60">Success</p>
                </div>
                <div className="bg-coral/10 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-coral">
                    {executionResult.summary.failedNodes}
                  </p>
                  <p className="text-xs text-sea-mist/60">Failed</p>
                </div>
              </div>

              {/* Node Results */}
              <div>
                <h4 className="text-xs font-semibold text-sea-mist/60 uppercase tracking-wider mb-3">
                  Agent Logs
                </h4>
                <div className="space-y-2">
                  {executionResult.nodeResults.map((nodeResult) => (
                    <div
                      key={nodeResult.nodeId}
                      className="bg-sea-mist/5 rounded-xl overflow-hidden"
                    >
                      {/* Node Header */}
                      <button
                        onClick={() => toggleExpanded(nodeResult.nodeId)}
                        className="w-full flex items-center justify-between p-3 hover:bg-sea-mist/5 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              nodeResult.status === "success"
                                ? "bg-emerald-400"
                                : nodeResult.status === "failed"
                                ? "bg-coral"
                                : nodeResult.status === "running"
                                ? "bg-aqua-glow animate-pulse"
                                : "bg-sea-mist/40"
                            }`}
                          />
                          <span className="text-sm font-medium text-foam-white">
                            {nodeResult.label || nodeResult.nodeId}
                          </span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${getStatusColor(
                              nodeResult.status
                            )}`}
                          >
                            {nodeResult.status}
                          </span>
                        </div>
                        {expandedNodes.has(nodeResult.nodeId) ? (
                          <ChevronDown className="w-4 h-4 text-sea-mist/40" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-sea-mist/40" />
                        )}
                      </button>

                      {/* Node Details */}
                      <AnimatePresence>
                        {expandedNodes.has(nodeResult.nodeId) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-sea-mist/10"
                          >
                            <div className="p-3 space-y-3">
                              {/* Timing */}
                              <div className="flex justify-between text-xs">
                                <span className="text-sea-mist/40">
                                  Duration
                                </span>
                                <span className="text-sea-mist/80">
                                  {nodeResult.duration
                                    ? `${nodeResult.duration}ms`
                                    : "-"}
                                </span>
                              </div>

                              {/* Summary (for swap agent) */}
                              {nodeResult.output?.summary && (
                                <div>
                                  <p className="text-xs text-sea-mist/40 mb-1">Summary</p>
                                  <div className="bg-emerald-500/10 rounded-lg p-3">
                                    <pre className="text-xs text-emerald-400 whitespace-pre-wrap">
                                      {String(nodeResult.output.summary)}
                                    </pre>
                                  </div>
                                </div>
                              )}

                              {/* Explorer Link (for swap agent) */}
                              {nodeResult.output?.explorerLink && (
                                <a
                                  href={String(nodeResult.output.explorerLink)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-aqua-glow hover:text-aqua-glow/80 transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  View on Cardanoscan
                                </a>
                              )}

                              {/* Output */}
                              {nodeResult.output &&
                                Object.keys(nodeResult.output).length > 0 && (
                                  <div>
                                    <p className="text-xs text-sea-mist/40 mb-1">
                                      Full Output
                                    </p>
                                    <div className="bg-abyss/50 rounded-lg p-2">
                                      <pre className="text-xs text-emerald-400/80 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                                        {JSON.stringify(
                                          nodeResult.output,
                                          null,
                                          2
                                        )}
                                      </pre>
                                    </div>
                                  </div>
                                )}

                              {/* Error */}
                              {nodeResult.error && (
                                <div>
                                  <p className="text-xs text-sea-mist/40 mb-1">
                                    Error
                                  </p>
                                  <div className="bg-coral/10 rounded-lg p-2">
                                    <pre className="text-xs text-coral overflow-x-auto whitespace-pre-wrap">
                                      {nodeResult.error}
                                    </pre>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>

              {/* Execution ID */}
              <div className="pt-2 border-t border-sea-mist/10">
                <p className="text-xs text-sea-mist/40">
                  Execution ID:{" "}
                  <span className="font-mono text-sea-mist/60">
                    {executionResult.executionId}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
