import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, ArrowRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@meshsdk/react';
import { BrowserWallet } from '@meshsdk/core';

// Bubble background component
function BubbleBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(40)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            bottom: `-${Math.random() * 20}%`,
            width: `${Math.random() * 8 + 4}px`,
            height: `${Math.random() * 8 + 4}px`,
            background: `radial-gradient(circle at 30% 30%, rgba(34, 211, 238, 0.4), rgba(8, 145, 178, 0.2))`,
            boxShadow: 'inset 0 0 10px rgba(255,255,255,0.1)',
          }}
          animate={{
            y: [0, -window.innerHeight * 1.2],
            x: [0, (Math.random() - 0.5) * 100],
            scale: [1, 1.2, 0.8],
          }}
          transition={{
            duration: 8 + Math.random() * 6,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}

// Available wallet type
interface WalletInfo {
  id: string;
  name: string;
  icon: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { wallet, connected, connect, disconnect } = useWallet();
  const [availableWallets, setAvailableWallets] = useState<WalletInfo[]>([]);
  const [authStep, setAuthStep] = useState<'connect' | 'sign' | 'success' | 'error'>('connect');
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [walletAddress, setWalletAddress] = useState<string>('');

  // Fetch available wallets on mount
  useEffect(() => {
    const getWallets = async () => {
      const wallets = await BrowserWallet.getAvailableWallets();
      setAvailableWallets(wallets);
    };
    getWallets();
  }, []);

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
      }
    };
    getAddress();
  }, [connected, wallet]);

  // Default wallet icons for common wallets
  const defaultWalletIcons: Record<string, string> = {
    eternl: '🔷',
    nami: '🌊',
    flint: '🔥',
    yoroi: '📘',
    typhon: '🌪️',
    gerowallet: '🦊',
    nufi: '✨',
  };

  const handleWalletConnect = async (walletId: string) => {
    setSelectedWallet(walletId);
    setIsConnecting(true);
    try {
      await connect(walletId);
      setAuthStep('sign');
    } catch {
      setErrorMessage('Failed to connect wallet. Please try again.');
      setAuthStep('error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSignature = async () => {
    if (!wallet) return;
    
    setIsSigning(true);
    try {
      const nonce = `AdaFlow Authentication - ${Date.now()}`;
      
      const addresses = await wallet.getUsedAddresses();
      const address = addresses[0];
      
      // signData expects: address (bech32) and payload (string)
      const signature = await wallet.signData(nonce, address);
      
      if (signature) {
        // Here you would typically send the signature to your backend for verification
        // For now, we'll simulate a successful auth
        console.log('Signature:', signature);
        setAuthStep('success');
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        setErrorMessage('Signature rejected. Please try again.');
        setAuthStep('error');
      }
    } catch (err) {
      console.error('Sign error:', err);
      setErrorMessage('Failed to sign message. Please try again.');
      setAuthStep('error');
    } finally {
      setIsSigning(false);
    }
  };

  const resetAuth = () => {
    disconnect();
    setAuthStep('connect');
    setSelectedWallet(null);
    setErrorMessage('');
    setWalletAddress('');
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 12)}...${address.slice(-8)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-deep-ocean">
      <BubbleBackground />
      
      {/* Underwater light rays */}
      <div 
        className="absolute top-0 left-1/3 w-1 h-full pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(34, 211, 238, 0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
          transform: 'rotate(15deg) scaleX(15)',
        }}
      />
      <div 
        className="absolute top-0 right-1/4 w-1 h-full pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(8, 145, 178, 0.1) 0%, transparent 60%)',
          filter: 'blur(80px)',
          transform: 'rotate(-10deg) scaleX(20)',
        }}
      />

      {/* Gradient orbs - bioluminescent */}
      <div 
        className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(8, 145, 178, 0.15) 0%, transparent 70%)',
        }}
      />
      <div 
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(20, 240, 181, 0.08) 0%, transparent 70%)',
        }}
      />

      {/* Login Card */}
      <motion.div
        className="relative w-full max-w-md mx-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-current-blue/20 to-aqua-glow/20 rounded-3xl blur-xl" />
        
        <div className="relative glass-card p-8 rounded-2xl">
          {/* Border with aquatic glow */}
          <div 
            className="absolute inset-0 rounded-2xl border border-current-blue/30 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(8, 145, 178, 0.05), rgba(34, 211, 238, 0.05))',
            }}
          />

          <AnimatePresence mode="wait">
            {/* Connect Wallet Step */}
            {authStep === 'connect' && (
              <motion.div
                key="connect"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-center mb-8">
                  <motion.div
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-current-blue to-aqua-glow flex items-center justify-center mx-auto mb-4"
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  >
                    <Wallet className="w-8 h-8 text-foam-white" />
                  </motion.div>
                  <h1 className="text-2xl font-bold text-foam-white font-heading mb-2">
                    Welcome Back
                  </h1>
                  <p className="text-sea-mist/70 text-sm">
                    Connect your wallet to access your AI agents
                  </p>
                </div>

                {/* Wallet Options */}
                <div className="space-y-3">
                  {availableWallets.length > 0 ? (
                    availableWallets.map((wallet) => (
                      <motion.button
                        key={wallet.id}
                        className="w-full flex items-center gap-4 p-4 rounded-xl bg-abyss/50 border border-current-blue/20 hover:bg-current-blue/10 hover:border-aqua-glow/30 transition-all group"
                        whileHover={{ scale: 1.02, x: 5 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleWalletConnect(wallet.id)}
                        disabled={isConnecting}
                      >
                        <div className="w-10 h-10 rounded-xl bg-foam-white/10 flex items-center justify-center overflow-hidden">
                          {wallet.icon ? (
                            <img src={wallet.icon} alt={wallet.name} className="w-6 h-6" />
                          ) : (
                            <span className="text-lg">{defaultWalletIcons[wallet.id.toLowerCase()] || '💳'}</span>
                          )}
                        </div>
                        <span className="flex-1 text-left text-foam-white font-medium">
                          {wallet.name}
                        </span>
                        {isConnecting && selectedWallet === wallet.id ? (
                          <Loader2 className="w-5 h-5 text-aqua-glow animate-spin" />
                        ) : (
                          <ArrowRight className="w-5 h-5 text-sea-mist/40 group-hover:text-aqua-glow transition-colors" />
                        )}
                      </motion.button>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sea-mist/60 text-sm mb-4">
                        No Cardano wallets detected
                      </p>
                      <a
                        href="https://eternl.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-aqua-glow hover:underline text-sm"
                      >
                        Install Eternl Wallet →
                      </a>
                    </div>
                  )}
                </div>

                {/* Info */}
                <p className="text-center text-xs text-sea-mist/40 mt-6">
                  By connecting, you agree to our Terms of Service
                </p>
              </motion.div>
            )}

            {/* Sign Message Step */}
            {authStep === 'sign' && (
              <motion.div
                key="sign"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-center mb-8">
                  <motion.div
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-aqua-glow to-bioluminescent flex items-center justify-center mx-auto mb-4"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <CheckCircle className="w-8 h-8 text-foam-white" />
                  </motion.div>
                  <h1 className="text-2xl font-bold text-foam-white font-heading mb-2">
                    Verify Ownership
                  </h1>
                  <p className="text-sea-mist/70 text-sm">
                    Sign a message to prove wallet ownership
                  </p>
                </div>

                {/* Connected Wallet Info */}
                <div className="p-4 rounded-xl bg-abyss/50 border border-bioluminescent/20 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-bioluminescent/20 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-bioluminescent" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-sea-mist/60">Connected Wallet</p>
                      <p className="text-sm text-foam-white font-mono">
                        {walletAddress ? truncateAddress(walletAddress) : 'Loading...'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sign Button */}
                <motion.button
                  className="w-full liquid-btn py-4 flex items-center justify-center gap-2 bg-gradient-to-br from-current-blue to-aqua-glow text-foam-white font-heading font-semibold rounded-xl"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSignature}
                  disabled={isSigning}
                >
                  {isSigning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Waiting for signature...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign Message</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </motion.button>

                {/* Back Button */}
                <button
                  className="w-full mt-4 text-sm text-sea-mist/60 hover:text-foam-white transition-colors"
                  onClick={resetAuth}
                >
                  Use a different wallet
                </button>
              </motion.div>
            )}

            {/* Success Step */}
            {authStep === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="text-center py-8"
              >
                <motion.div
                  className="w-20 h-20 rounded-full bg-bioluminescent/20 flex items-center justify-center mx-auto mb-6"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                >
                  <CheckCircle className="w-10 h-10 text-bioluminescent" />
                </motion.div>
                <h1 className="text-2xl font-bold text-foam-white font-heading mb-2">
                  Welcome to AdaFlow!
                </h1>
                <p className="text-sea-mist/70 text-sm mb-4">
                  Redirecting to your dashboard...
                </p>
                <Loader2 className="w-6 h-6 text-aqua-glow animate-spin mx-auto" />
              </motion.div>
            )}

            {/* Error Step */}
            {authStep === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="text-center py-8"
              >
                <motion.div
                  className="w-20 h-20 rounded-full bg-coral/20 flex items-center justify-center mx-auto mb-6"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                >
                  <AlertCircle className="w-10 h-10 text-coral" />
                </motion.div>
                <h1 className="text-2xl font-bold text-foam-white font-heading mb-2">
                  Authentication Failed
                </h1>
                <p className="text-sea-mist/70 text-sm mb-6">
                  {errorMessage}
                </p>
                <motion.button
                  className="liquid-btn py-3 px-8 bg-gradient-to-br from-current-blue to-aqua-glow text-foam-white font-heading font-semibold rounded-xl"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={resetAuth}
                >
                  Try Again
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
