import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const navLinks = [
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Agents', href: '#agents' },
  { label: 'Dashboard', href: '#dashboard' },
  { label: 'Docs', href: '#' },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isLandingPage = location.pathname === '/';

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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-current-blue to-aqua-glow flex items-center justify-center relative overflow-hidden">
                <span className="text-foam-white font-bold text-sm relative z-10">AF</span>
                {/* Liquid shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-transparent translate-y-full animate-[shimmer_2s_infinite]" />
              </div>
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
                {navLinks.map((link, index) => (
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
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
