import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@meshsdk/react';
import { LogOut, Settings, Bot, TrendingUp, Shield, Zap, RefreshCw, Workflow } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CustodialWalletCard from '../components/CustodialWalletCard';
import WalletBalances from '../components/WalletBalances';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { wallet, connected, disconnect } = useWallet();
  const { user, logout, isLoading } = useAuth();
  const [walletAddress, setWalletAddress] = useState<string>('');

  // Get wallet address when connected
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
      } else if (user?.walletAddress) {
        // Fall back to stored wallet address
        setWalletAddress(user.walletAddress);
      }
    };
    getAddress();
  }, [connected, wallet, user]);

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
              Welcome to AdaFlow
            </h1>
            <p className="text-sea-mist">
              Wallet: <span className="font-mono text-aqua-glow">{walletAddress ? truncateAddress(walletAddress) : ''}</span>
            </p>
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

        {/* Wallet Balances with USD Value */}
        <div className="mb-12">
          <WalletBalances />
        </div>

        {/* Custodial Wallet Section */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-foam-white font-heading mb-6">Your Custodial Wallet</h2>
          <CustodialWalletCard />
        </div>

        {/* Active Agents */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-foam-white font-heading mb-6">Your Active Agents</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Swap Agent', icon: Zap, status: 'Active', gradient: 'from-current-blue to-aqua-glow' },
              { name: 'Yield Agent', icon: TrendingUp, status: 'Active', gradient: 'from-aqua-glow to-seafoam' },
              { name: 'Risk Guard', icon: Shield, status: 'Monitoring', gradient: 'from-bioluminescent to-emerald-500' },
              { name: 'Add Agent', icon: Bot, status: 'Configure', gradient: 'from-sea-mist/30 to-sea-mist/10' },
            ].map((agent, index) => {
              const Icon = agent.icon;
              const isAddCard = agent.name === 'Add Agent';
              return (
                <motion.div
                  key={agent.name}
                  className={`glass-card p-6 cursor-pointer ${isAddCard ? 'border-dashed' : ''}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  whileHover={{ y: -5 }}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${agent.gradient} flex items-center justify-center mb-4`}>
                    <Icon className="w-6 h-6 text-foam-white" />
                  </div>
                  <h3 className="font-bold text-foam-white mb-1">{agent.name}</h3>
                  <p className={`text-sm ${isAddCard ? 'text-sea-mist/40' : 'text-bioluminescent'}`}>
                    {agent.status}
                  </p>
                </motion.div>
              );
            })}
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
