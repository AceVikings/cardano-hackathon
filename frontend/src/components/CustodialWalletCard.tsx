import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@meshsdk/react';
import { 
  MeshTxBuilder,
  resolvePaymentKeyHash,
  BlockfrostProvider,
} from '@meshsdk/core';
import { 
  Wallet, 
  Plus, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
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
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('5');
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
    if (!connected || !wallet || !walletStatus?.initialized || !walletStatus.ownerPkh) {
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

      const lovelaceAmount = BigInt(Math.floor(amount * 1_000_000));

      // Get Blockfrost provider
      const blockfrost = new BlockfrostProvider('preprodTkz6j43OWTjf9kYQ2ajAeyIdV9pZTcI2');
      const txBuilder = new MeshTxBuilder({
        fetcher: blockfrost,
      });

      // Check if user already has a UTXO at the script address
      const scriptUtxos = await blockfrost.fetchAddressUTxOs(SCRIPT_ADDRESS);
      
      // Find existing UTXO belonging to this user
      let existingUtxo = null;
      let existingValue = BigInt(0);
      
      for (const utxo of scriptUtxos) {
        const plutusData = utxo.output?.plutusData;
        if (typeof plutusData === 'string') {
          const pkhMatch = plutusData.match(/d8799f581c([a-f0-9]{56})/i);
          if (pkhMatch && pkhMatch[1] === walletStatus.ownerPkh) {
            existingUtxo = utxo;
            existingValue = BigInt(utxo.output.amount.find((a: any) => a.unit === 'lovelace')?.quantity || '0');
            break;
          }
        }
      }

      let unsignedTx: string;
      let newTotalValue: bigint;

      // Datum for the output using { alternative, fields } format (works with this MeshSDK version)
      const datum = {
        alternative: 0,
        fields: [
          walletStatus.ownerPkh,
          walletStatus.approvedAgents || [],
        ],
      };

      // Script CBOR for consolidation
      const scriptCbor = '590a65590a620100003232323232323232323232322253330073232323232533300c3370e9001000899191919299980819b87480000044c8c94ccc050cdc3a40040022646464a66602e66e1d20000011323253330193370e9001000899191919299980f99b87480000044c8c8c8c94ccc08ccdc3a40000022646464646464a666052002264a66605266e1d200000113253330293370e900100089919299981619b87480080045300103d87a80001323253330293375e6e98004cc010010cdc00019bad302b0014bd70099802002000981700118160009bae30290013758604e00266006006605600460520026eb4c0940052f5c0264646464a666050002264a66605066e1d200200113253330283370e900000089919191919191919299981899b87480000044c8c8c94ccc0d0cdc3a40000022646464a66606e00220022940cdd7982000098200011bae303e001303e002375a607800260686ea804854ccc0c8cdc3a40040022646464a66606c66e1d200000113253330363370e9001000899191919299981d19b87480000044c8c94ccc0f0c0fc00852616375a607c002607c0046eb4c0f000458c0e4c0e800458c0e0004c0e0008c0d8004c0c8c0cc00858c0c400458c0b8c0bc00454ccc0b8cdc3a401800226464a66606466e1d20000011323253330343370e9001000899192999819181a8010a4c2a66606600229405280a503375e606a0046eb4c0d400458c0e0004c0e0008c0d8004c0c8c0cc0085858c0c400458c0b8c0bc00454ccc0b8cdc3a401c0022646464a66606466e1d200000113232533303333720004002298103d87a80001323253330333375e00c002006266e9520003303700133004004001133700004903d87a80003370e0020066eb4c0cc008c0dc008c0d40045858c0b8c0bc004c0b4004c0a4c0a8058dd6181380098118138a99812a4811856616c696461746f722072657475726e65642066616c73650013656533025302100115333026302200115333027302337540182a66604c604460506ea805c54ccc098c084c09cdd5018099191980080080e11299981499b8f375c605800400c29444cc00c00c004c0b400458c0ac00458c098c09c004c094004c084c08800cdd6180f800980d8110a99980e1808980f1baa00c1325333019301530183754008264a6660366030603460360022940c078c080004c0780085854ccc064c04cc068dd5008099299980c9808980d1baa00116300a301b301c301c0013758602e603660380022c6034002602a60300022c6ea8c058004c058008c050004c040008c048004c048008c040004c030008c038004c02800858c030004c020c02400458c01cc0200048c01cc020c020c020c0200045261365632533300549011856616c696461746f722072657475726e65642066616c73650013656153300249010f5f72656465656d65723a20566f6964001615330024912a57726f6e67207573616765206f6620636f6e7374727563746f723a20557365645f6279206d7573742062652000163001001222533300600214a22a6660086008600c6ea8004520001375a600e0046eb0c01c004dd7180100098008011bae001230022330020020010012253335573e0026aae78008d55ce8009baa0013754002ae6955ceaab9e5573eae815d0aba201';

      if (existingUtxo) {
        // CONSOLIDATE: Spend existing UTXO and create new one with combined value
        console.log('Consolidating existing UTXO with', Number(existingValue) / 1_000_000, 'ADA');
        
        newTotalValue = existingValue + lovelaceAmount;
        
        // Redeemer for Deposit action (constructor 0) - use { alternative, fields } format
        const redeemer = { alternative: 0, fields: [] };
        
        // Find collateral UTXO
        const collateralUtxo = utxos.find((utxo: any) => {
          const lovelace = utxo.output.amount.find((a: any) => a.unit === 'lovelace');
          const qty = BigInt(lovelace?.quantity ?? 0);
          return qty >= BigInt(5_000_000);
        });

        if (!collateralUtxo) {
          throw new Error('No suitable collateral UTXO found (need at least 5 ADA)');
        }

        unsignedTx = await txBuilder
          // Spend the existing script UTXO
          .spendingPlutusScriptV3()
          .txIn(
            existingUtxo.input.txHash,
            existingUtxo.input.outputIndex
          )
          .txInInlineDatumPresent()
          .txInRedeemerValue(redeemer)
          .txInScript(scriptCbor)
          // Create new UTXO with combined value
          .txOut(SCRIPT_ADDRESS, [
            { unit: 'lovelace', quantity: newTotalValue.toString() }
          ])
          .txOutInlineDatumValue(datum)
          // Collateral
          .txInCollateral(
            collateralUtxo.input.txHash,
            collateralUtxo.input.outputIndex,
            collateralUtxo.output.amount,
            collateralUtxo.output.address
          )
          // Owner must sign
          .requiredSignerHash(walletStatus.ownerPkh)
          .changeAddress(changeAddress)
          .selectUtxosFrom(utxos)
          .complete();
      } else {
        // INITIAL DEPOSIT: No existing UTXO, create fresh one
        console.log('Creating new custodial wallet UTXO');
        newTotalValue = lovelaceAmount;

        unsignedTx = await txBuilder
          .txOut(SCRIPT_ADDRESS, [
            { unit: 'lovelace', quantity: lovelaceAmount.toString() }
          ])
          .txOutInlineDatumValue(datum)
          .changeAddress(changeAddress)
          .selectUtxosFrom(utxos)
          .complete();
      }

      // Sign with user's wallet
      const signedTx = await wallet.signTx(unsignedTx, true);
      
      // Submit transaction
      const txHashResult = await wallet.submitTx(signedTx);
      setTxHash(txHashResult);

      // Update cached balance
      const currentTokens = walletStatus.lastKnownBalance?.tokens || [];
      await updateWalletBalance(newTotalValue.toString(), currentTokens);

      // Refresh status
      await fetchWalletStatus();

      setSuccess(`Deposited ${amount} ADA successfully! Total: ${Number(newTotalValue) / 1_000_000} ADA`);
      setDepositAmount('10');
      
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error('Deposit failed:', err);
      setError(err.message || err.error || 'Deposit failed');
    } finally {
      setDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!connected || !wallet || !walletStatus?.initialized || !walletStatus.ownerPkh) {
      setError('Wallet not ready');
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < 2) {
      setError('Minimum withdrawal is 2 ADA');
      return;
    }

    try {
      setWithdrawing(true);
      setError(null);
      setTxHash(null);

      // Get the Blockfrost provider for fetching UTXOs
      const blockfrost = new BlockfrostProvider('preprodTkz6j43OWTjf9kYQ2ajAeyIdV9pZTcI2');
      
      // Get user addresses
      const addresses = await wallet.getUsedAddresses();
      const userAddress = addresses[0];

      // Get UTXOs from the script address and find the one belonging to this user
      const scriptUtxos = await blockfrost.fetchAddressUTxOs(SCRIPT_ADDRESS);
      
      console.log('Looking for owner PKH:', walletStatus.ownerPkh);
      
      // Find THE SINGLE UTXO belonging to this user (by checking datum owner)
      let userUtxo = null;
      for (const utxo of scriptUtxos) {
        const plutusData = utxo.output?.plutusData;
        if (typeof plutusData === 'string') {
          const pkhMatch = plutusData.match(/d8799f581c([a-f0-9]{56})/i);
          if (pkhMatch && pkhMatch[1] === walletStatus.ownerPkh) {
            userUtxo = utxo;
            console.log('Found user UTXO:', utxo.input.txHash, '#', utxo.input.outputIndex);
            break;
          }
        }
      }

      if (!userUtxo) {
        throw new Error('No custodial wallet UTXO found for your wallet');
      }

      // Get user wallet UTXOs for fees
      const walletUtxos = await wallet.getUtxos();
      if (!walletUtxos || walletUtxos.length === 0) {
        throw new Error('No UTXOs available for fees');
      }

      const lovelaceAmount = BigInt(Math.floor(amount * 1_000_000));
      const utxoValue = BigInt(userUtxo.output.amount.find((a: any) => a.unit === 'lovelace')?.quantity || '0');
      
      console.log('UTXO value:', utxoValue.toString(), 'lovelace');
      console.log('Requested withdraw:', lovelaceAmount.toString(), 'lovelace');
      
      if (lovelaceAmount > utxoValue) {
        throw new Error(`Insufficient balance. Available: ${Number(utxoValue) / 1_000_000} ADA`);
      }

      // Build the withdraw transaction
      const txBuilder = new MeshTxBuilder({
        fetcher: blockfrost,
      });

      // The redeemer for owner withdraw (UserWithdraw = constructor 3)
      const redeemer = { alternative: 3, fields: [] };

      // Script CBOR (compiled Aiken script)
      const scriptCbor = '590a65590a620100003232323232323232323232322253330073232323232533300c3370e9001000899191919299980819b87480000044c8c94ccc050cdc3a40040022646464a66602e66e1d20000011323253330193370e9001000899191919299980f99b87480000044c8c8c8c94ccc08ccdc3a40000022646464646464a666052002264a66605266e1d200000113253330293370e900100089919299981619b87480080045300103d87a80001323253330293375e6e98004cc010010cdc00019bad302b0014bd70099802002000981700118160009bae30290013758604e00266006006605600460520026eb4c0940052f5c0264646464a666050002264a66605066e1d200200113253330283370e900000089919191919191919299981899b87480000044c8c8c94ccc0d0cdc3a40000022646464a66606e00220022940cdd7982000098200011bae303e001303e002375a607800260686ea804854ccc0c8cdc3a40040022646464a66606c66e1d200000113253330363370e9001000899191919299981d19b87480000044c8c94ccc0f0c0fc00852616375a607c002607c0046eb4c0f000458c0e4c0e800458c0e0004c0e0008c0d8004c0c8c0cc00858c0c400458c0b8c0bc00454ccc0b8cdc3a401800226464a66606466e1d20000011323253330343370e9001000899192999819181a8010a4c2a66606600229405280a503375e606a0046eb4c0d400458c0e0004c0e0008c0d8004c0c8c0cc0085858c0c400458c0b8c0bc00454ccc0b8cdc3a401c0022646464a66606466e1d200000113232533303333720004002298103d87a80001323253330333375e00c002006266e9520003303700133004004001133700004903d87a80003370e0020066eb4c0cc008c0dc008c0d40045858c0b8c0bc004c0b4004c0a4c0a8058dd6181380098118138a99812a4811856616c696461746f722072657475726e65642066616c73650013656533025302100115333026302200115333027302337540182a66604c604460506ea805c54ccc098c084c09cdd5018099191980080080e11299981499b8f375c605800400c29444cc00c00c004c0b400458c0ac00458c098c09c004c094004c084c08800cdd6180f800980d8110a99980e1808980f1baa00c1325333019301530183754008264a6660366030603460360022940c078c080004c0780085854ccc064c04cc068dd5008099299980c9808980d1baa00116300a301b301c301c0013758602e603660380022c6034002602a60300022c6ea8c058004c058008c050004c040008c048004c048008c040004c030008c038004c02800858c030004c020c02400458c01cc0200048c01cc020c020c020c0200045261365632533300549011856616c696461746f722072657475726e65642066616c73650013656153300249010f5f72656465656d65723a20566f6964001615330024912a57726f6e67207573616765206f6620636f6e7374727563746f723a20557365645f6279206d7573742062652000163001001222533300600214a22a6660086008600c6ea8004520001375a600e0046eb0c01c004dd7180100098008011bae001230022330020020010012253335573e0026aae78008d55ce8009baa0013754002ae6955ceaab9e5573eae815d0aba201';

      // Find a suitable collateral UTXO from user's wallet (need >= 5 ADA)
      const collateralUtxo = walletUtxos.find((utxo: any) => {
        const lovelace = utxo.output.amount.find((a: any) => a.unit === 'lovelace');
        const qty = BigInt(lovelace?.quantity ?? 0);
        return qty >= BigInt(5_000_000);
      });

      if (!collateralUtxo) {
        throw new Error('No suitable collateral UTXO found (need at least 5 ADA in your wallet)');
      }

      // Calculate remaining value
      const withdrawLovelace = lovelaceAmount;
      const remainingLovelace = utxoValue - withdrawLovelace;
      
      console.log('Withdrawing:', withdrawLovelace.toString(), 'lovelace');
      console.log('Remaining:', remainingLovelace.toString(), 'lovelace');

      // Create the datum for output (if partial withdraw)
      const outputDatum = {
        alternative: 0,
        fields: [
          walletStatus.ownerPkh,
          walletStatus.approvedAgents || [],
        ]
      };

      // Build transaction - use inline datum present for script input
      let tx = txBuilder
        .spendingPlutusScriptV3()
        .txIn(
          userUtxo.input.txHash,
          userUtxo.input.outputIndex
        )
        .txInInlineDatumPresent()
        .txInRedeemerValue(redeemer)
        .txInScript(scriptCbor)
        // Send requested amount to user
        .txOut(userAddress, [
          { unit: 'lovelace', quantity: withdrawLovelace.toString() }
        ]);
      
      // If there's remaining value >= minUTXO, send back to script
      if (remainingLovelace >= BigInt(2_000_000)) {
        tx = tx
          .txOut(SCRIPT_ADDRESS, [
            { unit: 'lovelace', quantity: remainingLovelace.toString() }
          ])
          .txOutInlineDatumValue(outputDatum);
      }

      // Add collateral for script execution
      tx = tx.txInCollateral(
        collateralUtxo.input.txHash,
        collateralUtxo.input.outputIndex,
        collateralUtxo.output.amount,
        collateralUtxo.output.address
      );

      // Required signer (owner must sign)
      tx = tx.requiredSignerHash(walletStatus.ownerPkh);

      const unsignedTx = await tx
        .changeAddress(userAddress)
        .selectUtxosFrom(walletUtxos)
        .complete();

      // Sign with user's wallet
      const signedTx = await wallet.signTx(unsignedTx, true);
      
      // Submit transaction
      const txHashResult = await wallet.submitTx(signedTx);
      setTxHash(txHashResult);

      // Update cached balance to the remaining value
      const currentTokens = walletStatus.lastKnownBalance?.tokens || [];
      await updateWalletBalance(remainingLovelace.toString(), currentTokens);

      // Refresh status
      await fetchWalletStatus();

      setSuccess(`Withdrew ${amount} ADA successfully! Remaining: ${Number(remainingLovelace) / 1_000_000} ADA`);
      setWithdrawAmount('5');
      
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error('Withdraw failed:', err);
      setError(err.message || err.error || 'Withdraw failed');
    } finally {
      setWithdrawing(false);
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

          {/* Withdraw Form */}
          <div className="space-y-3">
            <label className="text-sm text-sea-mist">Withdraw ADA</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Amount"
                  min="2"
                  step="1"
                  className="w-full px-4 py-3 rounded-xl bg-abyss/50 border border-sea-mist/20 text-foam-white placeholder-sea-mist/40 focus:outline-none focus:border-coral"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sea-mist/60">ADA</span>
              </div>
              <motion.button
                className="px-4 py-3 rounded-xl bg-coral text-foam-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                whileHover={{ scale: withdrawing || !connected ? 1 : 1.02 }}
                whileTap={{ scale: withdrawing || !connected ? 1 : 0.98 }}
                onClick={handleWithdraw}
                disabled={withdrawing || !connected}
              >
                {withdrawing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowUpFromLine className="w-5 h-5" />
                )}
                Withdraw
              </motion.button>
            </div>
            <p className="text-xs text-sea-mist/50">Minimum withdrawal: 2 ADA</p>
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
