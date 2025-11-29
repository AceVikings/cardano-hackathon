import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, User, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navLinks = [
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Agents', href: '#agents' },
  { label: 'Dashboard', href: '#dashboard' },
  { label: 'Docs', href: '#' },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isLandingPage = location.pathname === '/';

  const getUserDisplayName = () => {
    if (user?.displayName) return user.displayName;
    if (user?.email) return user.email.split('@')[0];
    return 'User';
  };

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
    navigate('/');
  };

  return (
    <>
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled ? 'py-3' : 'py-5'
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.8, 0.25, 1] }}
      >
        <div className="container mx-auto px-6">
          <div
            className={`flex items-center justify-between rounded-2xl transition-all duration-500 ${
              isScrolled ? 'bg-abyss/70 backdrop-blur-xl border border-current-blue/20 px-6 py-3' : 'px-0 py-0'
            }`}
          >
            {/* Logo */}
            <motion.div
              className="flex items-center gap-2 cursor-pointer"
              whileHover={{ scale: 1.02 }}
              onClick={() => navigate('/')}
            >
              <img 
                src="/logo.png" 
                alt="AdaFlow" 
                className="w-10 h-10 rounded-xl object-contain"
              />
              <span className="text-xl font-bold text-foam-white font-heading hidden sm:block">
                AdaFlow
              </span>
            </motion.div>

            {/* Desktop Nav */}
            {isLandingPage && (
              <div className="hidden md:flex items-center gap-8">
                {navLinks.map((link) => (
                  <motion.a
                    key={link.label}
                    href={link.href}
                    className="text-sm text-sea-mist/80 hover:text-foam-white transition-colors relative group"
                    whileHover={{ y: -2 }}
                  >
                    {link.label}
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-current-blue to-aqua-glow group-hover:w-full transition-all duration-300" />
                  </motion.a>
                ))}
              </div>
            )}

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-4">
              {isAuthenticated && user ? (
                <div className="relative">
                  <motion.button
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-abyss/70 border border-current-blue/30 text-foam-white hover:border-aqua-glow transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowUserMenu(!showUserMenu)}
                  >
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-current-blue to-aqua-glow flex items-center justify-center">
                      <User className="w-4 h-4 text-foam-white" />
                    </div>
                    <span className="text-sm">{getUserDisplayName()}</span>
                  </motion.button>
                  
                  {/* User Dropdown Menu */}
                  <AnimatePresence>
                    {showUserMenu && (
                      <motion.div
                        className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-abyss/95 backdrop-blur-lg border border-current-blue/30 overflow-hidden"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <button
                          className="w-full px-4 py-3 text-left text-sm text-sea-mist hover:bg-current-blue/20 hover:text-foam-white transition-colors flex items-center gap-2"
                          onClick={() => {
                            navigate('/dashboard');
                            setShowUserMenu(false);
                          }}
                        >
                          <User className="w-4 h-4" />
                          Dashboard
                        </button>
                        <button
                          className="w-full px-4 py-3 text-left text-sm text-sea-mist hover:bg-coral/20 hover:text-coral transition-colors flex items-center gap-2"
                          onClick={handleLogout}
                        >
                          <LogOut className="w-4 h-4" />
                          Logout
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <>
                  {location.pathname !== '/login' && (
                    <motion.button
                      className="ripple px-5 py-2.5 font-heading font-semibold text-sm uppercase tracking-wider text-sea-mist bg-transparent border border-current-blue/40 rounded-xl cursor-pointer transition-all duration-300 hover:text-foam-white hover:border-aqua-glow"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate('/login')}
                    >
                      Sign In
                    </motion.button>
                  )}
                  <motion.button
                    className="liquid-btn px-5 py-2.5 font-heading font-semibold text-sm uppercase tracking-wider text-foam-white bg-gradient-to-br from-current-blue to-aqua-glow rounded-xl cursor-pointer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/login')}
                  >
                    <span className="relative z-10">Launch App</span>
                  </motion.button>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <motion.button
              className="md:hidden w-10 h-10 rounded-lg bg-abyss/70 backdrop-blur-xl border border-current-blue/20 flex items-center justify-center text-foam-white"
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsMobileOpen(!isMobileOpen)}
            >
              {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-deep-ocean/95 backdrop-blur-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
            />

            {/* Menu Content */}
            <motion.div
              className="absolute top-24 left-6 right-6 bg-abyss/60 backdrop-blur-lg border border-current-blue/20 rounded-2xl p-6"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex flex-col gap-4">
                {isLandingPage && navLinks.map((link, index) => (
                  <motion.a
                    key={link.label}
                    href={link.href}
                    className="text-lg text-sea-mist hover:text-foam-white transition-colors py-2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    {link.label}
                  </motion.a>
                ))}
                <div className="h-px bg-foam-white/10 my-2" />
                {isAuthenticated && user ? (
                  <>
                    <div className="flex items-center gap-3 py-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-current-blue to-aqua-glow flex items-center justify-center">
                        <User className="w-4 h-4 text-foam-white" />
                      </div>
                      <span className="text-sm text-sea-mist">{getUserDisplayName()}</span>
                    </div>
                    <button
                      className="w-full py-3 font-heading font-semibold text-sm uppercase tracking-wider text-foam-white bg-gradient-to-br from-current-blue to-aqua-glow rounded-xl cursor-pointer transition-all duration-300"
                      onClick={() => {
                        navigate('/dashboard');
                        setIsMobileOpen(false);
                      }}
                    >
                      Dashboard
                    </button>
                    <button
                      className="w-full py-3 font-heading font-semibold text-sm uppercase tracking-wider text-sea-mist bg-transparent border border-coral/40 rounded-xl cursor-pointer transition-all duration-300 hover:text-coral hover:border-coral"
                      onClick={() => {
                        handleLogout();
                        setIsMobileOpen(false);
                      }}
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="w-full py-3 font-heading font-semibold text-sm uppercase tracking-wider text-sea-mist bg-transparent border border-current-blue/40 rounded-xl cursor-pointer transition-all duration-300 hover:text-foam-white hover:border-aqua-glow"
                      onClick={() => {
                        navigate('/login');
                        setIsMobileOpen(false);
                      }}
                    >
                      Sign In
                    </button>
                    <button
                      className="w-full py-3 font-heading font-semibold text-sm uppercase tracking-wider text-foam-white bg-gradient-to-br from-current-blue to-aqua-glow rounded-xl cursor-pointer transition-all duration-300"
                      onClick={() => {
                        navigate('/login');
                        setIsMobileOpen(false);
                      }}
                    >
                      <span>Launch App</span>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
