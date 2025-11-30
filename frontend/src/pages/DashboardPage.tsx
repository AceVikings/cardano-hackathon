import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, Settings, Zap, RefreshCw, Workflow, Clock, CheckCircle,
  Plus, Power, PowerOff, Trash2, Edit3, Wallet, Copy, ExternalLink,
  XCircle, AlertCircle, X, ChevronRight, ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  getWorkflows, 
  updateWorkflowStatus, 
  deleteWorkflow,
  getDeveloperWallet,
  getWalletBalance,
  getRecentExecutions,
  type WorkflowBasicInfo,
  type DeveloperWallet,
  type WalletBalance,
  type RecentExecution
} from '../services/api';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout, isLoading: authLoading } = useAuth();
  const { success, error, info } = useToast();
  
  const [workflows, setWorkflows] = useState<WorkflowBasicInfo[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true);
  const [wallet, setWallet] = useState<DeveloperWallet | null>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [recentExecutions, setRecentExecutions] = useState<RecentExecution[]>([]);
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState<RecentExecution | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchWorkflows();
    fetchWallet();
    fetchExecutions();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const data = await getWorkflows();
      setWorkflows(data);
    } catch (err) {
      console.error('Failed to fetch workflows:', err);
      error('Failed to load workflows', 'Please try again later');
    } finally {
      setIsLoadingWorkflows(false);
    }
  };

  const fetchExecutions = async () => {
    try {
      const data = await getRecentExecutions(10);
      setRecentExecutions(data);
    } catch (err) {
      console.error('Failed to fetch executions:', err);
      // Don't show error toast - executions are supplementary
    } finally {
      setIsLoadingExecutions(false);
    }
  };

  const fetchWallet = async () => {
    try {
      const data = await getDeveloperWallet();
      setWallet(data);
      // Fetch balance after getting wallet
      fetchBalance();
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
      // Don't show error toast - wallet will be created on first access
    } finally {
      setIsLoadingWallet(false);
    }
  };

  const fetchBalance = async () => {
    setIsLoadingBalance(true);
    try {
      const balance = await getWalletBalance();
      setWalletBalance(balance);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
      // Balance might fail if wallet is new with no UTXOs
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    info('Copied!', `${label} copied to clipboard`);
  };

  const truncateAddress = (address: string | undefined | null) => {
    if (!address) return '';
    if (address.length <= 20) return address;
    return `${address.slice(0, 12)}...${address.slice(-8)}`;
  };

  const handleToggleStatus = async (workflow: WorkflowBasicInfo) => {
    try {
      const newStatus = workflow.status === 'active' ? 'inactive' : 'active';
      const updated = await updateWorkflowStatus(workflow.id, newStatus);
      setWorkflows(prev => prev.map(w => w.id === workflow.id ? { ...w, status: updated.status } : w));
      success(
        newStatus === 'active' ? 'Workflow activated' : 'Workflow deactivated',
        workflow.name
      );
    } catch (err) {
      error('Failed to update status', 'Please try again');
    }
  };

  const handleDelete = async (workflow: WorkflowBasicInfo) => {
    if (!confirm(`Are you sure you want to delete "${workflow.name}"?`)) return;
    
    try {
      await deleteWorkflow(workflow.id);
      setWorkflows(prev => prev.filter(w => w.id !== workflow.id));
      success('Workflow deleted', workflow.name);
    } catch (err) {
      error('Failed to delete workflow', 'Please try again');
    }
  };

  const getUserDisplayName = () => {
    if (user?.displayName) return user.displayName;
    if (user?.email) return user.email.split('@')[0];
    return 'User';
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Calculate stats
  const activeWorkflows = workflows.filter(w => w.status === 'active').length;
  const totalExecutions = workflows.reduce((sum, w) => sum + (w.stats?.totalExecutions || 0), 0);
  const successfulExecutions = workflows.reduce((sum, w) => sum + (w.stats?.successfulExecutions || 0), 0);
  const successRate = totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 0;

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 text-aqua-glow animate-spin mx-auto mb-4" />
          <p className="text-sea-mist">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-bold text-foam-white font-heading mb-2">
              Welcome, {getUserDisplayName()}
            </h1>
            {user?.email && (
              <p className="text-sea-mist/60 text-sm">
                {user.email}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <motion.button
              className="p-3 rounded-xl glass text-sea-mist hover:text-foam-white transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Settings className="w-5 h-5" />
            </motion.button>
            <motion.button
              className="flex items-center gap-2 px-4 py-3 rounded-xl glass text-sea-mist hover:text-foam-white transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm">Sign Out</span>
            </motion.button>
          </div>
        </div>

        {/* Developer Wallet Card */}
        <motion.div
          className="glass-card p-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-bioluminescent to-aqua-glow flex items-center justify-center">
                <Wallet className="w-6 h-6 text-foam-white" />
              </div>
              <div>
                <p className="text-sea-mist/60 text-sm">Your Agent Wallet</p>
                {isLoadingWallet ? (
                  <div className="flex items-center gap-2 mt-1">
                    <RefreshCw className="w-4 h-4 text-aqua-glow animate-spin" />
                    <span className="text-sm text-sea-mist">Loading wallet...</span>
                  </div>
                ) : wallet ? (
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-foam-white font-mono text-sm">
                      {truncateAddress(wallet.paymentAddress)}
                    </code>
                    <button
                      onClick={() => copyToClipboard(wallet.paymentAddress, 'Address')}
                      className="p-1 hover:bg-sea-mist/10 rounded transition-colors"
                    >
                      <Copy className="w-4 h-4 text-sea-mist/60 hover:text-aqua-glow" />
                    </button>
                    <a
                      href={`https://preprod.cardanoscan.io/address/${wallet.paymentAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-sea-mist/10 rounded transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-sea-mist/60 hover:text-aqua-glow" />
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-sea-mist/50">No wallet initialized</p>
                )}
              </div>
            </div>
            
            {/* Balance and Network */}
            <div className="flex items-center gap-6">
              {/* Balance */}
              <div className="text-right">
                <p className="text-sea-mist/60 text-xs mb-1">Balance</p>
                {isLoadingBalance ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 text-aqua-glow animate-spin" />
                    <span className="text-sm text-sea-mist">...</span>
                  </div>
                ) : walletBalance ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-foam-white font-mono">
                      {walletBalance.ada.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-sm text-aqua-glow font-medium">ADA</span>
                    <button
                      onClick={fetchBalance}
                      className="p-1 hover:bg-sea-mist/10 rounded transition-colors ml-1"
                      title="Refresh balance"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-sea-mist/40 hover:text-aqua-glow" />
                    </button>
                  </div>
                ) : wallet ? (
                  <span className="text-sm text-sea-mist/50">0.00 ADA</span>
                ) : null}
              </div>
              
              {/* Network Badge */}
              <div className="text-right">
                <p className="text-sea-mist/60 text-xs mb-1">Network</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                  Preprod
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <motion.div
            className="glass-card p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-current-blue to-aqua-glow flex items-center justify-center">
                <Workflow className="w-6 h-6 text-foam-white" />
              </div>
              <div>
                <p className="text-sea-mist/60 text-sm">Active Workflows</p>
                <p className="text-2xl font-bold text-foam-white">{activeWorkflows}</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            className="glass-card p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-aqua-glow to-bioluminescent flex items-center justify-center">
                <Zap className="w-6 h-6 text-foam-white" />
              </div>
              <div>
                <p className="text-sea-mist/60 text-sm">Total Executions</p>
                <p className="text-2xl font-bold text-foam-white">{totalExecutions}</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            className="glass-card p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-bioluminescent to-seafoam flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-foam-white" />
              </div>
              <div>
                <p className="text-sea-mist/60 text-sm">Success Rate</p>
                <p className="text-2xl font-bold text-foam-white">{successRate > 0 ? `${successRate}%` : '--'}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* My Workflows */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foam-white font-heading">My Workflows</h2>
            <motion.button
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-aqua-glow text-deep-ocean font-medium text-sm"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/editor')}
            >
              <Plus className="w-4 h-4" />
              New Workflow
            </motion.button>
          </div>

          {isLoadingWorkflows ? (
            <div className="glass-card p-12 text-center">
              <RefreshCw className="w-8 h-8 text-aqua-glow animate-spin mx-auto mb-4" />
              <p className="text-sea-mist">Loading workflows...</p>
            </div>
          ) : workflows.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Workflow className="w-12 h-12 text-sea-mist/30 mx-auto mb-4" />
              <p className="text-sea-mist/60 mb-2">No workflows yet</p>
              <p className="text-sm text-sea-mist/40 mb-6">Create your first workflow to get started</p>
              <motion.button
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-aqua-glow text-deep-ocean font-semibold"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/editor')}
              >
                <Plus className="w-5 h-5" />
                Create Workflow
              </motion.button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflows.map((workflow, index) => (
                <motion.div
                  key={workflow.id}
                  className="glass-card p-5 hover:ring-1 hover:ring-aqua-glow/30 transition-all cursor-pointer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/editor/${workflow.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        workflow.status === 'active' 
                          ? 'bg-gradient-to-br from-bioluminescent to-emerald-500' 
                          : 'bg-gradient-to-br from-current-blue to-aqua-glow'
                      }`}>
                        <Workflow className="w-5 h-5 text-foam-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foam-white">{workflow.name}</h3>
                        <span className={`inline-flex items-center gap-1 text-xs ${
                          workflow.status === 'active' ? 'text-bioluminescent' : 'text-sea-mist/50'
                        }`}>
                          {workflow.status === 'active' ? (
                            <><Power className="w-3 h-3" /> Active</>
                          ) : (
                            <><PowerOff className="w-3 h-3" /> Inactive</>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {workflow.description && (
                    <p className="text-sm text-sea-mist/50 line-clamp-2 mb-3">{workflow.description}</p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-sea-mist/40">
                    <span>{workflow.nodeCount} nodes · {workflow.edgeCount} connections</span>
                    <span>{new Date(workflow.updatedAt).toLocaleDateString()}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-sea-mist/10">
                    <motion.button
                      onClick={(e) => { e.stopPropagation(); handleToggleStatus(workflow); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                        workflow.status === 'active'
                          ? 'bg-bioluminescent/20 text-bioluminescent hover:bg-bioluminescent/30'
                          : 'bg-sea-mist/10 text-sea-mist hover:bg-sea-mist/20'
                      }`}
                      whileTap={{ scale: 0.98 }}
                    >
                      {workflow.status === 'active' ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                      {workflow.status === 'active' ? 'Deactivate' : 'Activate'}
                    </motion.button>
                    <motion.button
                      onClick={(e) => { e.stopPropagation(); navigate(`/editor/${workflow.id}`); }}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-current-blue/20 text-aqua-glow hover:bg-current-blue/30 text-xs font-medium transition-colors"
                      whileTap={{ scale: 0.98 }}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </motion.button>
                    <motion.button
                      onClick={(e) => { e.stopPropagation(); handleDelete(workflow); }}
                      className="flex items-center justify-center py-2 px-3 rounded-lg bg-coral/10 text-coral hover:bg-coral/20 text-xs transition-colors"
                      whileTap={{ scale: 0.98 }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Executions */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foam-white font-heading">Recent Executions</h2>
            <motion.button
              className="text-sm text-aqua-glow hover:text-aqua-glow/80 flex items-center gap-1"
              whileHover={{ x: 3 }}
              onClick={fetchExecutions}
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingExecutions ? 'animate-spin' : ''}`} />
              Refresh
            </motion.button>
          </div>
          <div className="glass-card overflow-hidden">
            {isLoadingExecutions ? (
              <div className="py-12 text-center">
                <RefreshCw className="w-8 h-8 text-aqua-glow animate-spin mx-auto mb-4" />
                <p className="text-sea-mist/60">Loading executions...</p>
              </div>
            ) : recentExecutions.length === 0 ? (
              <div className="py-12 text-center">
                <Clock className="w-12 h-12 text-sea-mist/30 mx-auto mb-4" />
                <p className="text-sea-mist/60 mb-2">No recent executions</p>
                <p className="text-sm text-sea-mist/40">Your workflow executions will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-sea-mist/10">
                      <th className="text-left py-4 px-6 text-xs font-semibold text-sea-mist/60 uppercase tracking-wider">Workflow</th>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-sea-mist/60 uppercase tracking-wider">Trigger</th>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-sea-mist/60 uppercase tracking-wider">Agents</th>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-sea-mist/60 uppercase tracking-wider">Status</th>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-sea-mist/60 uppercase tracking-wider">Duration</th>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-sea-mist/60 uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sea-mist/5">
                    {recentExecutions.map((execution) => (
                      <motion.tr
                        key={execution.executionId}
                        className="hover:bg-sea-mist/5 transition-colors cursor-pointer"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => {
                          setSelectedExecution(execution);
                          setExpandedAgents(new Set());
                        }}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <Workflow className="w-4 h-4 text-aqua-glow" />
                            <span className="text-foam-white font-medium text-sm">
                              {execution.workflowName}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sea-mist/80 text-sm capitalize">
                            {execution.triggerType?.replace('_', ' ') || 'Manual'}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-1 text-sm">
                            <span className="text-emerald-400">{execution.summary?.successfulNodes || 0}</span>
                            <span className="text-sea-mist/40">/</span>
                            <span className="text-sea-mist/60">{execution.summary?.totalNodes || 0}</span>
                            <span className="text-sea-mist/40 ml-1">agents</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            execution.status === 'success'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : execution.status === 'failed'
                              ? 'bg-coral/20 text-coral'
                              : execution.status === 'partial'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-aqua-glow/20 text-aqua-glow'
                          }`}>
                            {execution.status === 'success' ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : execution.status === 'failed' ? (
                              <XCircle className="w-3 h-3" />
                            ) : execution.status === 'partial' ? (
                              <AlertCircle className="w-3 h-3" />
                            ) : (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            )}
                            {execution.status}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sea-mist/60 text-sm">
                            {execution.duration ? `${(execution.duration / 1000).toFixed(1)}s` : '-'}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sea-mist/60 text-sm">
                            {new Date(execution.executedAt).toLocaleString()}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Execution Detail Modal */}
      <AnimatePresence>
        {selectedExecution && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-abyss/80 backdrop-blur-sm"
              onClick={() => setSelectedExecution(null)}
            />
            
            {/* Modal */}
            <motion.div
              className="relative w-full max-w-3xl max-h-[85vh] bg-deep-ocean border border-sea-mist/10 rounded-2xl shadow-2xl overflow-hidden"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-sea-mist/10">
                <div>
                  <h3 className="text-xl font-bold text-foam-white font-heading">
                    Execution Details
                  </h3>
                  <p className="text-sm text-sea-mist/60 mt-1">
                    {selectedExecution.workflowName}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <motion.button
                    onClick={() => navigate(`/editor/${selectedExecution.workflowId}`)}
                    className="px-3 py-1.5 text-sm text-aqua-glow hover:bg-aqua-glow/10 rounded-lg transition-colors flex items-center gap-1"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Open Workflow <ExternalLink className="w-3.5 h-3.5" />
                  </motion.button>
                  <button
                    onClick={() => setSelectedExecution(null)}
                    className="p-2 hover:bg-sea-mist/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-sea-mist/60" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
                {/* Summary Row */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-sea-mist/5 rounded-xl p-4">
                    <p className="text-xs text-sea-mist/60 mb-1">Status</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      selectedExecution.status === 'success'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : selectedExecution.status === 'failed'
                        ? 'bg-coral/20 text-coral'
                        : selectedExecution.status === 'partial'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-aqua-glow/20 text-aqua-glow'
                    }`}>
                      {selectedExecution.status === 'success' ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : selectedExecution.status === 'failed' ? (
                        <XCircle className="w-3 h-3" />
                      ) : selectedExecution.status === 'partial' ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      )}
                      {selectedExecution.status}
                    </span>
                  </div>
                  <div className="bg-sea-mist/5 rounded-xl p-4">
                    <p className="text-xs text-sea-mist/60 mb-1">Trigger</p>
                    <p className="text-sm text-foam-white capitalize">
                      {selectedExecution.triggerType?.replace('_', ' ') || 'Manual'}
                    </p>
                  </div>
                  <div className="bg-sea-mist/5 rounded-xl p-4">
                    <p className="text-xs text-sea-mist/60 mb-1">Duration</p>
                    <p className="text-sm text-foam-white">
                      {selectedExecution.duration ? `${(selectedExecution.duration / 1000).toFixed(2)}s` : '-'}
                    </p>
                  </div>
                  <div className="bg-sea-mist/5 rounded-xl p-4">
                    <p className="text-xs text-sea-mist/60 mb-1">Executed At</p>
                    <p className="text-sm text-foam-white">
                      {new Date(selectedExecution.executedAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Trigger Data */}
                {selectedExecution.triggerData && Object.keys(selectedExecution.triggerData).length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-foam-white mb-3">Trigger Data</h4>
                    <div className="bg-sea-mist/5 rounded-xl p-4">
                      <pre className="text-xs text-sea-mist/80 overflow-x-auto">
                        {JSON.stringify(selectedExecution.triggerData, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Agent Logs */}
                <div>
                  <h4 className="text-sm font-semibold text-foam-white mb-3">
                    Agent Execution Logs ({selectedExecution.summary?.successfulNodes || 0}/{selectedExecution.summary?.totalNodes || 0} successful)
                  </h4>
                  <div className="space-y-2">
                    {(selectedExecution.agentLogs || []).map((agent, index) => (
                      <div
                        key={agent.nodeId || index}
                        className="bg-sea-mist/5 rounded-xl overflow-hidden"
                      >
                        {/* Agent Header - Clickable */}
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedAgents);
                            if (newExpanded.has(agent.nodeId)) {
                              newExpanded.delete(agent.nodeId);
                            } else {
                              newExpanded.add(agent.nodeId);
                            }
                            setExpandedAgents(newExpanded);
                          }}
                          className="w-full flex items-center justify-between p-4 hover:bg-sea-mist/5 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full ${
                              agent.status === 'success' ? 'bg-emerald-400' :
                              agent.status === 'failed' ? 'bg-coral' :
                              agent.status === 'running' ? 'bg-aqua-glow animate-pulse' :
                              'bg-sea-mist/40'
                            }`} />
                            <span className="text-sm font-medium text-foam-white">
                              {agent.label || agent.agentId || 'Unknown Agent'}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              agent.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                              agent.status === 'failed' ? 'bg-coral/20 text-coral' :
                              'bg-sea-mist/10 text-sea-mist/60'
                            }`}>
                              {agent.status}
                            </span>
                            {agent.duration && (
                              <span className="text-xs text-sea-mist/40">
                                {(agent.duration / 1000).toFixed(2)}s
                              </span>
                            )}
                          </div>
                          {expandedAgents.has(agent.nodeId) ? (
                            <ChevronDown className="w-4 h-4 text-sea-mist/40" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-sea-mist/40" />
                          )}
                        </button>

                        {/* Agent Details - Expandable */}
                        <AnimatePresence>
                          {expandedAgents.has(agent.nodeId) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-sea-mist/10"
                            >
                              <div className="p-4 space-y-4">
                                {/* Timing */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-xs text-sea-mist/40 mb-1">Start Time</p>
                                    <p className="text-xs text-sea-mist/80">
                                      {agent.startTime ? new Date(agent.startTime).toLocaleString() : '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-sea-mist/40 mb-1">End Time</p>
                                    <p className="text-xs text-sea-mist/80">
                                      {agent.endTime ? new Date(agent.endTime).toLocaleString() : '-'}
                                    </p>
                                  </div>
                                </div>

                                {/* Inputs */}
                                {agent.inputs && Object.keys(agent.inputs).length > 0 && (
                                  <div>
                                    <p className="text-xs text-sea-mist/40 mb-2">Inputs</p>
                                    <div className="bg-abyss/50 rounded-lg p-3">
                                      <pre className="text-xs text-sea-mist/80 overflow-x-auto whitespace-pre-wrap">
                                        {JSON.stringify(agent.inputs, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                )}

                                {/* Output */}
                                {agent.output && Object.keys(agent.output).length > 0 && (
                                  <div>
                                    <p className="text-xs text-sea-mist/40 mb-2">Output</p>
                                    <div className="bg-abyss/50 rounded-lg p-3">
                                      <pre className="text-xs text-emerald-400/80 overflow-x-auto whitespace-pre-wrap">
                                        {JSON.stringify(agent.output, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                )}

                                {/* Error */}
                                {agent.error && (
                                  <div>
                                    <p className="text-xs text-sea-mist/40 mb-2">Error</p>
                                    <div className="bg-coral/10 rounded-lg p-3">
                                      <pre className="text-xs text-coral overflow-x-auto whitespace-pre-wrap">
                                        {agent.error}
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
                <div className="mt-6 pt-4 border-t border-sea-mist/10">
                  <p className="text-xs text-sea-mist/40">
                    Execution ID: <span className="text-sea-mist/60 font-mono">{selectedExecution.executionId}</span>
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
