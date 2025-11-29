import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, Settings, Zap, RefreshCw, Workflow, Clock, CheckCircle,
  ArrowRight, Plus, Power, PowerOff, Trash2, Edit3 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  getWorkflows, 
  updateWorkflowStatus, 
  deleteWorkflow,
  type WorkflowBasicInfo 
} from '../services/api';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout, isLoading: authLoading } = useAuth();
  const { success, error } = useToast();
  
  const [workflows, setWorkflows] = useState<WorkflowBasicInfo[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true);

  useEffect(() => {
    fetchWorkflows();
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
            >
              View All <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-sea-mist/10">
                    <th className="text-left py-4 px-6 text-xs font-semibold text-sea-mist/60 uppercase tracking-wider">Agent</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-sea-mist/60 uppercase tracking-wider">Action</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-sea-mist/60 uppercase tracking-wider">Amount</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-sea-mist/60 uppercase tracking-wider">Status</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-sea-mist/60 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sea-mist/5">
                  {/* Empty state - shown when no executions */}
                </tbody>
              </table>
            </div>
            <div className="py-12 text-center">
              <Clock className="w-12 h-12 text-sea-mist/30 mx-auto mb-4" />
              <p className="text-sea-mist/60 mb-2">No recent executions</p>
              <p className="text-sm text-sea-mist/40">Your workflow executions will appear here</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
