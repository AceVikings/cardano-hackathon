import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@meshsdk/react';
import { LogOut, Settings, Zap, RefreshCw, Workflow, Clock, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CustodialWalletCard from '../components/CustodialWalletCard';
import WalletBalances from '../components/WalletBalances';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { wallet, connected } = useWallet();
  const { user, logout, isLoading } = useAuth();
  const [walletAddress, setWalletAddress] = useState<string>('');

  // Get wallet address when connected (from Cardano wallet, not auth user)
  useEffect(() => {
    const getAddress = async () => {
      if (connected && wallet) {
        try {
          const addresses = await wallet.getUsedAddresses();
          if (addresses.length > 0) {
            setWalletAddress(addresses[0]);
          }
        } catch (err) {
          console.error('Failed to get address:', err);
        }
      }
    };
    getAddress();
  }, [connected, wallet]);

  const getUserDisplayName = () => {
    if (user?.displayName) return user.displayName;
    if (user?.email) return user.email.split('@')[0];
    return 'User';
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  // Loading state
  if (isLoading) {
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
            {walletAddress && (
              <p className="text-sea-mist">
                Wallet: <span className="font-mono text-aqua-glow">{truncateAddress(walletAddress)}</span>
              </p>
            )}
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
              <span className="text-sm">Disconnect</span>
            </motion.button>
          </div>
        </div>

        {/* Portfolio & Custodial Wallet Row */}
        <div className="grid lg:grid-cols-2 gap-6 mb-12">
          <WalletBalances />
          <CustodialWalletCard />
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
                  {/* Placeholder executions - will be replaced with real data */}
                  {[
                    { agent: 'Swap Agent', action: 'ADA → MIN', amount: '50 ADA', status: 'success', time: '2 min ago' },
                    { agent: 'Transfer Agent', action: 'Send to addr1...x4f2', amount: '25 ADA', status: 'success', time: '15 min ago' },
                    { agent: 'Swap Agent', action: 'ADA → SNEK', amount: '100 ADA', status: 'pending', time: '32 min ago' },
                    { agent: 'Swap Agent', action: 'MIN → ADA', amount: '1,250 MIN', status: 'failed', time: '1 hour ago' },
                  ].map((execution, index) => (
                    <motion.tr 
                      key={index}
                      className="hover:bg-sea-mist/5 transition-colors"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            execution.agent === 'Swap Agent' 
                              ? 'bg-gradient-to-br from-current-blue to-aqua-glow' 
                              : 'bg-gradient-to-br from-aqua-glow to-seafoam'
                          }`}>
                            <Zap className="w-4 h-4 text-foam-white" />
                          </div>
                          <span className="font-medium text-foam-white">{execution.agent}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sea-mist">{execution.action}</td>
                      <td className="py-4 px-6 text-foam-white font-mono">{execution.amount}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          execution.status === 'success' 
                            ? 'bg-bioluminescent/20 text-bioluminescent' 
                            : execution.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-coral/20 text-coral'
                        }`}>
                          {execution.status === 'success' && <CheckCircle className="w-3 h-3" />}
                          {execution.status === 'pending' && <Clock className="w-3 h-3" />}
                          {execution.status === 'failed' && <XCircle className="w-3 h-3" />}
                          {execution.status.charAt(0).toUpperCase() + execution.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sea-mist/60 text-sm">{execution.time}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Empty state - shown when no executions */}
            {false && (
              <div className="py-12 text-center">
                <Clock className="w-12 h-12 text-sea-mist/30 mx-auto mb-4" />
                <p className="text-sea-mist/60 mb-2">No recent executions</p>
                <p className="text-sm text-sea-mist/40">Your agent executions will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Coming Soon Notice */}
        <motion.div
          className="glass-card p-8 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="text-xl font-bold text-foam-white font-heading mb-2">
            Build Your Agent Workflow
          </h3>
          <p className="text-sea-mist mb-6">
            Use our visual editor to connect multiple AI agents and create powerful automated strategies.
          </p>
          <motion.button
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-aqua-glow text-deep-ocean font-semibold"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/editor')}
          >
            <Workflow className="w-5 h-5" />
            Open Agent Editor
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
