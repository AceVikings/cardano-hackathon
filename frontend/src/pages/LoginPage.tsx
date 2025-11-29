import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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

// Google Icon Component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, signInWithGoogle, isAuthenticated, isLoading, error: authError, clearError } = useAuth();
  
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [authStep, setAuthStep] = useState<'form' | 'success' | 'error'>('form');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  // Handle auth errors
  useEffect(() => {
    if (authError) {
      setLocalError(authError);
      setAuthStep('error');
    }
  }, [authError]);

  const validateForm = (): boolean => {
    setLocalError(null);
    
    if (!email.trim()) {
      setLocalError('Email is required');
      return false;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalError('Please enter a valid email address');
      return false;
    }
    
    if (!password) {
      setLocalError('Password is required');
      return false;
    }
    
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return false;
    }
    
    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    clearError();
    setLocalError(null);
    
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName || undefined);
      }
      setAuthStep('success');
      setTimeout(() => {
        const from = (location.state as any)?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      }, 1500);
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed');
      setAuthStep('error');
    }
  };

  const handleGoogleSignIn = async () => {
    clearError();
    setLocalError(null);
    
    try {
      await signInWithGoogle();
      setAuthStep('success');
      setTimeout(() => {
        const from = (location.state as any)?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      }, 1500);
    } catch (err: any) {
      setLocalError(err.message || 'Google sign-in failed');
      setAuthStep('error');
    }
  };

  const resetForm = () => {
    setAuthStep('form');
    setLocalError(null);
    clearError();
  };

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setLocalError(null);
    clearError();
    setPassword('');
    setConfirmPassword('');
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
            {/* Form Step */}
            {authStep === 'form' && (
              <motion.div
                key="form"
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
                    <Mail className="w-8 h-8 text-foam-white" />
                  </motion.div>
                  <h1 className="text-2xl font-bold text-foam-white font-heading mb-2">
                    {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
                  </h1>
                  <p className="text-sea-mist/70 text-sm">
                    {mode === 'signin' 
                      ? 'Sign in to access your AI agents' 
                      : 'Sign up to start building AI agents'}
                  </p>
                </div>

                {/* Error Message */}
                {localError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-3 rounded-xl bg-coral/10 border border-coral/30 flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-coral flex-shrink-0" />
                    <p className="text-sm text-coral">{localError}</p>
                  </motion.div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Display Name (signup only) */}
                  {mode === 'signup' && (
                    <div>
                      <label className="block text-sm text-sea-mist/70 mb-2">Display Name (optional)</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sea-mist/40" />
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Your name"
                          className="w-full pl-11 pr-4 py-3 rounded-xl bg-abyss/50 border border-current-blue/20 text-foam-white placeholder:text-sea-mist/30 focus:outline-none focus:border-aqua-glow/50 transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  {/* Email */}
                  <div>
                    <label className="block text-sm text-sea-mist/70 mb-2">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sea-mist/40" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-abyss/50 border border-current-blue/20 text-foam-white placeholder:text-sea-mist/30 focus:outline-none focus:border-aqua-glow/50 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm text-sea-mist/70 mb-2">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sea-mist/40" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-11 pr-12 py-3 rounded-xl bg-abyss/50 border border-current-blue/20 text-foam-white placeholder:text-sea-mist/30 focus:outline-none focus:border-aqua-glow/50 transition-colors"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sea-mist/40 hover:text-foam-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password (signup only) */}
                  {mode === 'signup' && (
                    <div>
                      <label className="block text-sm text-sea-mist/70 mb-2">Confirm Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sea-mist/40" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-11 pr-12 py-3 rounded-xl bg-abyss/50 border border-current-blue/20 text-foam-white placeholder:text-sea-mist/30 focus:outline-none focus:border-aqua-glow/50 transition-colors"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-sea-mist/40 hover:text-foam-white transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <motion.button
                    type="submit"
                    className="w-full liquid-btn py-4 flex items-center justify-center gap-2 bg-gradient-to-br from-current-blue to-aqua-glow text-foam-white font-heading font-semibold rounded-xl"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{mode === 'signin' ? 'Signing in...' : 'Creating account...'}</span>
                      </>
                    ) : (
                      <>
                        <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-4 my-6">
                  <div className="flex-1 h-px bg-current-blue/20" />
                  <span className="text-sm text-sea-mist/40">or</span>
                  <div className="flex-1 h-px bg-current-blue/20" />
                </div>

                {/* Google Sign In */}
                <motion.button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-foam-white/5 border border-current-blue/20 hover:bg-foam-white/10 hover:border-aqua-glow/30 transition-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isLoading}
                >
                  <GoogleIcon className="w-5 h-5" />
                  <span className="text-foam-white font-medium">Continue with Google</span>
                </motion.button>

                {/* Toggle Mode */}
                <p className="text-center text-sm text-sea-mist/60 mt-6">
                  {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="text-aqua-glow hover:underline"
                  >
                    {mode === 'signin' ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
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
                  {localError || authError || 'An error occurred'}
                </p>
                <motion.button
                  className="liquid-btn py-3 px-8 bg-gradient-to-br from-current-blue to-aqua-glow text-foam-white font-heading font-semibold rounded-xl"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={resetForm}
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
