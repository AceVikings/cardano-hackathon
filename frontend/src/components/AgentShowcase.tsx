import { useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowLeftRight, TrendingUp, Shield, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

const agents = [
  {
    id: 'swap',
    icon: ArrowLeftRight,
    name: 'Swap Agent',
    description: 'Intelligently routes swaps across DEXs for optimal pricing with minimal slippage.',
    features: ['Multi-DEX Routing', 'MEV Protection', 'Gas Optimization'],
    gradient: 'from-current-blue to-blue-500',
    stats: { trades: '12.5K', volume: '$1.2M', savings: '0.8%' },
  },
  {
    id: 'yield',
    icon: TrendingUp,
    name: 'Yield Agent',
    description: 'Automatically compounds yields and reallocates to highest-performing pools.',
    features: ['Auto-Compound', 'APY Tracking', 'Pool Migration'],
    gradient: 'from-aqua-glow to-cyan-500',
    stats: { apy: '24.5%', pools: '8', earned: '$45K' },
  },
  {
    id: 'risk',
    icon: Shield,
    name: 'Risk Guard Agent',
    description: 'Monitors positions and executes protective actions during market volatility.',
    features: ['Liquidation Shield', 'Stop-Loss', 'Position Rebalancing'],
    gradient: 'from-bioluminescent to-emerald-500',
    stats: { protected: '$890K', alerts: '156', saves: '23' },
  },
  {
    id: 'arbitrage',
    icon: Sparkles,
    name: 'Arbitrage Agent',
    description: 'Identifies and executes cross-protocol arbitrage opportunities in milliseconds.',
    features: ['Flash Loans', 'Cross-DEX', 'Real-time Scanning'],
    gradient: 'from-coral to-orange-500',
    stats: { ops: '3.2K', profit: '$28K', success: '94%' },
  },
];

function AgentCard({ agent, isActive }: { agent: typeof agents[0]; isActive: boolean }) {
  const Icon = agent.icon;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className={`relative flex-shrink-0 w-[340px] h-[450px] rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 ${
        isActive ? 'scale-100' : 'scale-95 opacity-60'
      }`}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ 
        rotateY: 5,
        rotateX: -5,
        scale: 1.02,
      }}
      style={{ 
        transformStyle: 'preserve-3d',
        perspective: 1000,
      }}
    >
      {/* Glass Background */}
      <div className="absolute inset-0 bg-abyss/40 backdrop-blur-lg border border-current-blue/20 rounded-2xl" />
      
      {/* Gradient Glow Behind */}
      <motion.div
        className={`absolute -inset-4 bg-gradient-to-br ${agent.gradient} rounded-3xl blur-2xl`}
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered || isActive ? 0.3 : 0 }}
        transition={{ duration: 0.4 }}
      />

      {/* Neon Border */}
      <motion.div
        className={`absolute inset-0 rounded-2xl border-2 border-transparent bg-gradient-to-br ${agent.gradient} opacity-0`}
        style={{ 
          WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
        animate={{ opacity: isHovered ? 0.8 : 0.3 }}
        transition={{ duration: 0.3 }}
      />

      {/* Content */}
      <div className="relative z-10 p-8 h-full flex flex-col">
        {/* Icon */}
        <motion.div
          className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${agent.gradient} flex items-center justify-center mb-6`}
          animate={{ 
            rotate: isHovered ? [0, -10, 10, 0] : 0,
            scale: isHovered ? 1.1 : 1,
          }}
          transition={{ duration: 0.5 }}
        >
          <Icon className="w-8 h-8 text-foam-white" />
        </motion.div>

        {/* Name */}
        <h3 className="text-2xl font-bold text-foam-white font-heading mb-3">
          {agent.name}
        </h3>

        {/* Description */}
        <p className="text-sea-mist/80 text-sm leading-relaxed mb-6 grow">
          {agent.description}
        </p>

        {/* Features */}
        <div className="flex flex-wrap gap-2 mb-6">
          {agent.features.map((feature) => (
            <span
              key={feature}
              className="px-3 py-1 text-xs rounded-full bg-foam-white/5 text-sea-mist/80 border border-foam-white/10"
            >
              {feature}
            </span>
          ))}
        </div>

        {/* Stats */}
        <motion.div
          className="grid grid-cols-3 gap-4 pt-4 border-t border-foam-white/10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {Object.entries(agent.stats).map(([key, value]) => (
            <div key={key} className="text-center">
              <div className="text-lg font-bold text-foam-white font-heading">{value}</div>
              <div className="text-xs text-sea-mist/50 uppercase tracking-wider">{key}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Tooltip on hover */}
      <motion.div
        className="absolute -top-2 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-abyss/60 backdrop-blur-xl border border-current-blue/20 text-xs text-foam-white whitespace-nowrap"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 10 }}
        transition={{ duration: 0.2 }}
      >
        Click to configure agent
      </motion.div>
    </motion.div>
  );
}

export default function AgentShowcase() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 360;
      const newIndex = direction === 'left' 
        ? Math.max(0, activeIndex - 1)
        : Math.min(agents.length - 1, activeIndex + 1);
      setActiveIndex(newIndex);
      carouselRef.current.scrollTo({
        left: newIndex * scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section ref={sectionRef} className="section relative overflow-hidden">
      {/* Background Gradient */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(8, 145, 178, 0.1) 0%, transparent 70%)',
        }}
      />

      <div className="container">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.25, 0.8, 0.25, 1] }}
          className="text-center mb-16"
        >
          <span className="text-sm text-aqua-glow uppercase tracking-widest font-medium mb-4 block">
            Agent Suite
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-foam-white font-heading mb-6">
            Meet Your{' '}
            <span className="gradient-text">AI Agents</span>
          </h2>
          <p className="text-sea-mist/80 max-w-2xl mx-auto text-lg">
            Specialized agents working around the clock to optimize your DeFi portfolio
          </p>
        </motion.div>

        {/* Carousel Controls */}
        <div className="flex justify-center gap-4 mb-8">
          <motion.button
            className="w-12 h-12 rounded-full bg-abyss/60 backdrop-blur-xl border border-current-blue/20 flex items-center justify-center text-sea-mist hover:text-foam-white transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => scroll('left')}
            disabled={activeIndex === 0}
          >
            <ChevronLeft className="w-5 h-5" />
          </motion.button>
          <motion.button
            className="w-12 h-12 rounded-full bg-abyss/60 backdrop-blur-xl border border-current-blue/20 flex items-center justify-center text-sea-mist hover:text-foam-white transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => scroll('right')}
            disabled={activeIndex === agents.length - 1}
          >
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Carousel */}
        <div 
          ref={carouselRef}
          className="flex gap-8 overflow-x-auto pb-8 snap-x snap-mandatory scrollbar-hide px-[calc(50%-170px)]"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {agents.map((agent, index) => (
            <div key={agent.id} className="snap-center">
              <AgentCard agent={agent} isActive={index === activeIndex} />
            </div>
          ))}
        </div>

        {/* Pagination Dots */}
        <div className="flex justify-center gap-3 mt-8">
          {agents.map((_, index) => (
            <motion.button
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === activeIndex 
                  ? 'bg-gradient-to-r from-current-blue to-aqua-glow w-8' 
                  : 'bg-sea-mist/30 hover:bg-sea-mist/50'
              }`}
              onClick={() => {
                setActiveIndex(index);
                if (carouselRef.current) {
                  carouselRef.current.scrollTo({
                    left: index * 360,
                    behavior: 'smooth',
                  });
                }
              }}
              whileHover={{ scale: 1.2 }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
