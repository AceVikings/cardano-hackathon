import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@meshsdk/react';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw,
  DollarSign,
  Coins
} from 'lucide-react';
import { 
  getWalletStatus, 
  type CustodialWalletStatus 
} from '../services/api';

// Minswap API for ADA price
const ADA_PRICE_API = 'https://agg-api.minswap.org/aggregator/ada-price?currency=usd';

interface AdaPrice {
  currency: string;
  value: {
    change_24h: number;
    price: number;
  };
}

interface WalletBalancesProps {
  className?: string;
}

export default function WalletBalances({ className = '' }: WalletBalancesProps) {
  const { wallet, connected } = useWallet();
  const [adaPrice, setAdaPrice] = useState<AdaPrice | null>(null);
  const [connectedBalance, setConnectedBalance] = useState<bigint>(0n);
  const [custodialBalance, setCustodialBalance] = useState<bigint>(0n);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch ADA price
  const fetchAdaPrice = useCallback(async () => {
    try {
      const response = await fetch(ADA_PRICE_API);
      const data: AdaPrice = await response.json();
      setAdaPrice(data);
    } catch (err) {
      console.error('Failed to fetch ADA price:', err);
    }
  }, []);

  // Fetch connected wallet balance
  const fetchConnectedBalance = useCallback(async () => {
    if (!connected || !wallet) {
      setConnectedBalance(0n);
      return;
    }

    try {
      const utxos = await wallet.getUtxos();
      const total = utxos.reduce((sum, utxo) => {
        const lovelace = utxo.output.amount.find(a => a.unit === 'lovelace');
        return sum + BigInt(lovelace?.quantity ?? 0);
      }, 0n);
      setConnectedBalance(total);
    } catch (err) {
      console.error('Failed to fetch connected balance:', err);
    }
  }, [connected, wallet]);

  // Fetch custodial wallet balance
  const fetchCustodialBalance = useCallback(async () => {
    try {
      const status = await getWalletStatus();
      const lovelace = status.lastKnownBalance?.lovelace || '0';
      setCustodialBalance(BigInt(lovelace));
    } catch (err) {
      console.error('Failed to fetch custodial balance:', err);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchAdaPrice(),
        fetchConnectedBalance(),
        fetchCustodialBalance(),
      ]);
      setLoading(false);
    };
    fetchAll();
  }, [fetchAdaPrice, fetchConnectedBalance, fetchCustodialBalance]);

  // Refresh connected balance when wallet changes
  useEffect(() => {
    if (connected) {
      fetchConnectedBalance();
    }
  }, [connected, fetchConnectedBalance]);

  // Refresh all balances
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchAdaPrice(),
      fetchConnectedBalance(),
      fetchCustodialBalance(),
    ]);
    setRefreshing(false);
  };

  // Format helpers
  const lovelaceToAda = (lovelace: bigint): number => {
    return Number(lovelace) / 1_000_000;
  };

  const formatAda = (ada: number): string => {
    return ada.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const formatUsd = (usd: number): string => {
    return usd.toLocaleString(undefined, { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    });
  };

  const connectedAda = lovelaceToAda(connectedBalance);
  const custodialAda = lovelaceToAda(custodialBalance);
  const totalAda = connectedAda + custodialAda;
  
  const connectedUsd = adaPrice ? connectedAda * adaPrice.value.price : 0;
  const custodialUsd = adaPrice ? custodialAda * adaPrice.value.price : 0;
  const totalUsd = connectedUsd + custodialUsd;

  const priceChange = adaPrice?.value.change_24h ?? 0;
  const isPositive = priceChange >= 0;

  if (loading) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 text-aqua-glow animate-spin" />
          <span className="ml-2 text-sea-mist">Loading balances...</span>
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-aqua-glow to-current-blue flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-foam-white" />
          </div>
          <div>
            <h3 className="font-bold text-foam-white">Portfolio Value</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-sea-mist/60">
                ADA: {adaPrice ? formatUsd(adaPrice.value.price) : '...'} 
              </span>
              {adaPrice && (
                <span className={`text-xs flex items-center gap-0.5 ${isPositive ? 'text-bioluminescent' : 'text-coral'}`}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(priceChange).toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        </div>
        <motion.button
          className="p-2 rounded-lg glass text-sea-mist hover:text-foam-white transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </motion.button>
      </div>

      {/* Total Value */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-aqua-glow/10 to-bioluminescent/10 border border-aqua-glow/20 mb-4">
        <p className="text-xs text-sea-mist/60 mb-1">Total Value</p>
        <div className="flex items-baseline gap-3">
          <p className="text-3xl font-bold text-foam-white font-heading">
            {formatUsd(totalUsd)}
          </p>
          <p className="text-lg text-aqua-glow">
            {formatAda(totalAda)} ADA
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-4">
        {/* Connected Wallet */}
        <div className="p-4 rounded-lg bg-abyss/50 border border-sea-mist/10">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-aqua-glow" />
            <p className="text-xs text-sea-mist/60">Connected Wallet</p>
          </div>
          <p className="text-xl font-bold text-foam-white">{formatAda(connectedAda)} <span className="text-sm text-aqua-glow">ADA</span></p>
          <p className="text-sm text-sea-mist/60">{formatUsd(connectedUsd)}</p>
        </div>

        {/* Custodial Wallet */}
        <div className="p-4 rounded-lg bg-abyss/50 border border-sea-mist/10">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-4 h-4 text-bioluminescent" />
            <p className="text-xs text-sea-mist/60">Custodial Wallet</p>
          </div>
          <p className="text-xl font-bold text-foam-white">{formatAda(custodialAda)} <span className="text-sm text-bioluminescent">ADA</span></p>
          <p className="text-sm text-sea-mist/60">{formatUsd(custodialUsd)}</p>
        </div>
      </div>
    </motion.div>
  );
}
