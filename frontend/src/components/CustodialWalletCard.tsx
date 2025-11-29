import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@meshsdk/react';
import { 
  MeshTxBuilder,
  resolvePaymentKeyHash,
} from '@meshsdk/core';
import { 
  Wallet, 
  Plus, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  ArrowDownToLine,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { 
  getWalletStatus, 
  initializeWallet, 
  updateWalletBalance,
  type CustodialWalletStatus 
} from '../services/api';

// Script address (same for all users - from contract deployment)
const SCRIPT_ADDRESS = 'addr_test1wp5ax0848y30atpkyv7avwtk45xzsx4r0v8n0kft4ffr8cg3rus49';

interface CustodialWalletCardProps {
  className?: string;
}

export default function CustodialWalletCard({ className = '' }: CustodialWalletCardProps) {
  const { wallet, connected, connect } = useWallet();
  const [walletStatus, setWalletStatus] = useState<CustodialWalletStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [depositAmount, setDepositAmount] = useState('10');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  // Auto-reconnect wallet on mount if previously connected
  useEffect(() => {
    const autoReconnect = async () => {
      if (connected) return; // Already connected
      
      const savedWallet = localStorage.getItem('adaflow_connected_wallet');
      if (savedWallet) {
        setReconnecting(true);
        try {
          await connect(savedWallet);
        } catch (err) {
          console.error('Auto-reconnect failed:', err);
          // Don't remove the saved wallet - user might want to manually reconnect
        } finally {
          setReconnecting(false);
        }
      }
    };
    
    autoReconnect();
  }, [connect, connected]);

  // Fetch wallet status on mount
  useEffect(() => {
    fetchWalletStatus();
  }, []);

  const fetchWalletStatus = async () => {
    try {
      setLoading(true);
      const status = await getWalletStatus();
      setWalletStatus(status);
    } catch (err: any) {
      console.error('Failed to fetch wallet status:', err);
      setError(err.error || 'Failed to fetch wallet status');
    } finally {
      setLoading(false);
    }
  };

  const handleInitialize = async () => {
    if (!connected || !wallet) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      setInitializing(true);
      setError(null);

      // Get user's payment key hash
      const addresses = await wallet.getUsedAddresses();
      const address = addresses[0];
      const pkh = resolvePaymentKeyHash(address);

      // Initialize wallet in backend
      const status = await initializeWallet(pkh);
      setWalletStatus(status);
      setSuccess('Custodial wallet initialized successfully!');
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to initialize wallet:', err);
      setError(err.error || 'Failed to initialize wallet');
    } finally {
      setInitializing(false);
    }
  };

  const handleDeposit = async () => {
    if (!connected || !wallet || !walletStatus?.initialized) {
      setError('Wallet not ready');
      return;
    }

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < 2) {
      setError('Minimum deposit is 2 ADA');
      return;
    }

    try {
      setDepositing(true);
      setError(null);
      setTxHash(null);

      // Get user UTXOs
      const utxos = await wallet.getUtxos();
      if (!utxos || utxos.length === 0) {
        throw new Error('No UTXOs available');
      }

      // Get change address
      const addresses = await wallet.getUsedAddresses();
      const changeAddress = addresses[0];

      // Create datum for the deposit
      const datum = {
        alternative: 0,
        fields: [
          walletStatus.ownerPkh, // owner
          [], // approved_agents (empty for now, will be added via on-chain tx)
        ],
      };

      // Build transaction
      const txBuilder = new MeshTxBuilder({
        fetcher: {
          fetchUTxOs: async () => utxos,
        },
      });

      const lovelaceAmount = BigInt(Math.floor(amount * 1_000_000));

      const unsignedTx = await txBuilder
        .txOut(SCRIPT_ADDRESS, [
          { unit: 'lovelace', quantity: lovelaceAmount.toString() }
        ])
        .txOutInlineDatumValue(datum)
        .changeAddress(changeAddress)
        .selectUtxosFrom(utxos)
        .complete();

      // Sign with user's wallet
      const signedTx = await wallet.signTx(unsignedTx);
      
      // Submit transaction
      const txHashResult = await wallet.submitTx(signedTx);
      setTxHash(txHashResult);

      // Update cached balance
      const currentLovelace = walletStatus.lastKnownBalance?.lovelace || '0';
      const currentTokens = walletStatus.lastKnownBalance?.tokens || [];
      const newLovelace = (BigInt(currentLovelace) + lovelaceAmount).toString();
      await updateWalletBalance(newLovelace, currentTokens);

      // Refresh status
      await fetchWalletStatus();

      setSuccess(`Deposited ${amount} ADA successfully!`);
      setDepositAmount('10');
      
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error('Deposit failed:', err);
      setError(err.message || err.error || 'Deposit failed');
    } finally {
      setDepositing(false);
    }
  };

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const formatLovelace = (lovelace: string) => {
    const ada = Number(lovelace) / 1_000_000;
    return ada.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 12)}...${addr.slice(-8)}`;
  };

  if (loading || reconnecting) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-aqua-glow animate-spin" />
          <span className="ml-2 text-sea-mist">
            {reconnecting ? 'Reconnecting wallet...' : 'Loading wallet...'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={`glass-card p-6 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-bioluminescent to-emerald-600 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-foam-white" />
          </div>
          <div>
            <h3 className="font-bold text-foam-white">Custodial Wallet</h3>
            <p className="text-xs text-sea-mist/60">Agent-managed funds</p>
          </div>
        </div>
        {walletStatus?.initialized && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-bioluminescent/20 border border-bioluminescent/40">
            <CheckCircle className="w-3 h-3 text-bioluminescent" />
            <span className="text-xs text-bioluminescent">Active</span>
          </div>
        )}
      </div>

      {/* Error/Success Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 rounded-lg bg-coral/20 border border-coral/40 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-coral flex-shrink-0" />
            <span className="text-sm text-coral">{error}</span>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 rounded-lg bg-bioluminescent/20 border border-bioluminescent/40 flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4 text-bioluminescent flex-shrink-0" />
            <span className="text-sm text-bioluminescent">{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {!walletStatus?.initialized ? (
        /* Not Initialized State */
        <div className="text-center py-4">
          <p className="text-sea-mist mb-4">
            Initialize your custodial wallet to allow AI agents to manage your funds securely.
          </p>
          {!connected ? (
            <p className="text-coral text-sm mb-4">
              Please connect your wallet using the button in the navbar to continue.
            </p>
          ) : null}
          <motion.button
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-aqua-glow text-deep-ocean font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: initializing || !connected ? 1 : 1.02 }}
            whileTap={{ scale: initializing || !connected ? 1 : 0.98 }}
            onClick={handleInitialize}
            disabled={initializing || !connected}
          >
            {initializing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Initialize Wallet
              </>
            )}
          </motion.button>
        </div>
      ) : (
        /* Initialized State */
        <div className="space-y-4">
          {/* Balance Display */}
          <div className="p-4 rounded-lg bg-abyss/50 border border-sea-mist/10">
            <p className="text-xs text-sea-mist/60 mb-1">Available Balance</p>
            <p className="text-2xl font-bold text-foam-white font-heading">
              {formatLovelace(walletStatus.lastKnownBalance?.lovelace || '0')} <span className="text-aqua-glow">ADA</span>
            </p>
          </div>

          {/* Script Address */}
          <div className="p-3 rounded-lg bg-current-blue/10 border border-current-blue/20">
            <p className="text-xs text-sea-mist/60 mb-1">Script Address</p>
            <div className="flex items-center gap-2">
              <code className="text-xs text-aqua-glow font-mono flex-1">
                {truncateAddress(SCRIPT_ADDRESS)}
              </code>
              <button
                onClick={() => copyToClipboard(SCRIPT_ADDRESS)}
                className="p-1 rounded hover:bg-sea-mist/10 transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-bioluminescent" />
                ) : (
                  <Copy className="w-4 h-4 text-sea-mist/60" />
                )}
              </button>
            </div>
          </div>

          {/* Deposit Form */}
          <div className="space-y-3">
            <label className="text-sm text-sea-mist">Deposit ADA</label>
            {!connected && (
              <p className="text-coral text-xs">
                Connect your wallet using the navbar to deposit.
              </p>
            )}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Amount"
                  min="2"
                  step="1"
                  className="w-full px-4 py-3 rounded-xl bg-abyss/50 border border-sea-mist/20 text-foam-white placeholder-sea-mist/40 focus:outline-none focus:border-aqua-glow"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sea-mist/60">ADA</span>
              </div>
              <motion.button
                className="px-4 py-3 rounded-xl bg-aqua-glow text-deep-ocean font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                whileHover={{ scale: depositing || !connected ? 1 : 1.02 }}
                whileTap={{ scale: depositing || !connected ? 1 : 0.98 }}
                onClick={handleDeposit}
                disabled={depositing || !connected}
              >
                {depositing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowDownToLine className="w-5 h-5" />
                )}
                Deposit
              </motion.button>
            </div>
            <p className="text-xs text-sea-mist/50">Minimum deposit: 2 ADA</p>
          </div>

          {/* Transaction Hash */}
          {txHash && (
            <div className="p-3 rounded-lg bg-bioluminescent/10 border border-bioluminescent/20">
              <p className="text-xs text-sea-mist/60 mb-1">Last Transaction</p>
              <a
                href={`https://preprod.cardanoscan.io/transaction/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-bioluminescent hover:underline"
              >
                <span className="font-mono">{txHash.slice(0, 16)}...{txHash.slice(-8)}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
