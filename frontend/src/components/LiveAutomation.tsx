import { useRef, useEffect, useState } from 'react';
import { motion, useInView, animate } from 'framer-motion';
import { Activity, ArrowUpRight, ArrowDownRight, Clock, Zap } from 'lucide-react';

// Animated number counter
function AnimatedNumber({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      const controls = animate(0, value, {
        duration: 2,
        ease: [0.25, 0.8, 0.25, 1],
        onUpdate: (v) => setDisplayValue(Math.round(v * 100) / 100),
      });
      return () => controls.stop();
    }
  }, [isInView, value]);

  return (
    <span ref={ref}>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
}

// Transaction Flow Animation
function TransactionFlow() {
  return (
    <div className="relative h-32 overflow-hidden">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute flex items-center gap-4 text-xs"
          initial={{ x: -100, opacity: 0 }}
          animate={{
            x: ['0%', '100%'],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 4,
            delay: i * 0.8,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{ top: `${i * 25}px` }}
        >
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-abyss/50 border border-current-blue/20">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-current-blue to-aqua-glow flex items-center justify-center">
              <Zap className="w-3 h-3 text-foam-white" />
            </div>
            <span className="text-sea-mist">Swap {Math.floor(Math.random() * 1000)} ADA</span>
            <ArrowUpRight className="w-4 h-4 text-bioluminescent" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Live Graph Component
function LiveGraph() {
  const [points, setPoints] = useState<number[]>([]);
  const maxPoints = 20;

  useEffect(() => {
    const interval = setInterval(() => {
      setPoints(prev => {
        const newValue = 50 + Math.random() * 30 + Math.sin(Date.now() / 1000) * 10;
        const updated = [...prev, newValue].slice(-maxPoints);
        return updated;
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const path = points.length > 1
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i / (maxPoints - 1)) * 100} ${100 - p}`).join(' ')
    : '';

  return (
    <div className="relative h-24 w-full">
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Grid lines */}
        {[...Array(5)].map((_, i) => (
          <line
            key={i}
            x1="0"
            y1={i * 25}
            x2="100"
            y2={i * 25}
            stroke="rgba(200, 208, 221, 0.05)"
            strokeWidth="0.5"
          />
        ))}
        
        {/* Gradient fill */}
        <defs>
          <linearGradient id="graphGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(34, 211, 238, 0.3)" />
            <stop offset="100%" stopColor="rgba(34, 211, 238, 0)" />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0891b2" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        
        {/* Fill area */}
        {points.length > 1 && (
          <path
            d={`${path} L 100 100 L 0 100 Z`}
            fill="url(#graphGradient)"
          />
        )}
        
        {/* Line */}
        {points.length > 1 && (
          <path
            d={path}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
        
        {/* Glow effect on last point */}
        {points.length > 0 && (
          <circle
            cx={100}
            cy={100 - points[points.length - 1]}
            r="3"
            fill="#22d3ee"
            className="animate-pulse"
          />
        )}
      </svg>
    </div>
  );
}

// Holographic Ring
function HolographicRing({ size = 200, delay = 0 }: { size?: number; delay?: number }) {
  return (
    <motion.div
      className="absolute rounded-full border border-aqua-glow/20"
      style={{ width: size, height: size }}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.3, 0.1, 0.3],
        rotate: 360,
      }}
      transition={{
        duration: 8,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

export default function LiveAutomation() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  const recentTransactions = [
    { type: 'Swap', amount: '2,450 ADA → 125 MIN', time: '2s ago', status: 'success' },
    { type: 'Yield', amount: '+12.5 ADA rewards', time: '15s ago', status: 'success' },
    { type: 'Rebalance', amount: '3 positions adjusted', time: '1m ago', status: 'success' },
    { type: 'Guard', amount: 'Risk threshold OK', time: '2m ago', status: 'warning' },
  ];

  return (
    <section ref={sectionRef} className="section relative overflow-hidden bg-abyss/30">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <HolographicRing size={400} delay={0} />
          <HolographicRing size={500} delay={2} />
          <HolographicRing size={600} delay={4} />
        </div>
      </div>

      <div className="container relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <span className="text-sm text-aqua-glow uppercase tracking-widest font-medium mb-4 block">
            Live Dashboard
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-foam-white font-heading mb-6">
            Automation in{' '}
            <span className="gradient-text">Action</span>
          </h2>
          <p className="text-sea-mist/80 max-w-2xl mx-auto text-lg">
            Real-time view of your agents executing strategies across the Cardano ecosystem
          </p>
        </motion.div>

        {/* Dashboard Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Stats Panel */}
          <motion.div
            className="lg:col-span-2 glass-card p-6 relative overflow-hidden"
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {/* HUD Corner Decorations */}
            <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-aqua-glow/50" />
            <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-aqua-glow/50" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-current-blue/50" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-current-blue/50" />

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-bioluminescent animate-pulse" />
                <span className="text-xs text-sea-mist uppercase tracking-widest">System Active</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-sea-mist/60">
                <Clock className="w-4 h-4" />
                Last sync: 3s ago
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Portfolio Value', value: 45230, prefix: '$', change: '+12.4%', positive: true },
                { label: 'Active Agents', value: 4, suffix: ' running', change: 'Optimal', positive: true },
                { label: '24h Transactions', value: 156, change: '+23', positive: true },
                { label: 'Gas Saved', value: 234, suffix: ' ADA', change: 'This week', positive: true },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-foam-white font-heading">
                    <AnimatedNumber value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                  </div>
                  <div className="text-xs text-sea-mist/60 mt-1">{stat.label}</div>
                  <div className={`text-xs mt-1 ${stat.positive ? 'text-bioluminescent' : 'text-coral'}`}>
                    {stat.change}
                  </div>
                </div>
              ))}
            </div>

            {/* Live Graph */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-sea-mist/60 uppercase tracking-wider">Portfolio Performance</span>
                <div className="flex items-center gap-1 text-bioluminescent text-sm">
                  <ArrowUpRight className="w-4 h-4" />
                  <span>+8.3%</span>
                </div>
              </div>
              <LiveGraph />
            </div>

            {/* Transaction Flow */}
            <div className="border-t border-foam-white/5 pt-4">
              <span className="text-xs text-sea-mist/60 uppercase tracking-wider mb-4 block">Live Transaction Flow</span>
              <TransactionFlow />
            </div>
          </motion.div>

          {/* Recent Activity Panel */}
          <motion.div
            className="glass-card p-6"
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-aqua-glow" />
              <span className="text-sm font-medium text-foam-white">Recent Activity</span>
            </div>

            <div className="space-y-4">
              {recentTransactions.map((tx, index) => (
                <motion.div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg bg-foam-white/5 hover:bg-foam-white/10 transition-colors"
                  initial={{ opacity: 0, y: 10 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.6 + index * 0.1 }}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    tx.status === 'success' ? 'bg-bioluminescent/20' : 'bg-coral/20'
                  }`}>
                    {tx.status === 'success' ? (
                      <ArrowUpRight className="w-4 h-4 text-bioluminescent" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-coral" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foam-white font-medium">{tx.type}</div>
                    <div className="text-xs text-sea-mist/60 truncate">{tx.amount}</div>
                  </div>
                  <div className="text-xs text-sea-mist/40">{tx.time}</div>
                </motion.div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="mt-6 pt-6 border-t border-foam-white/5">
              <button className="w-full btn-ghost text-xs py-3">
                View Full History
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
