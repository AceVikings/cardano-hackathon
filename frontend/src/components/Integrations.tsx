import { useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

const integrations = [
  {
    name: 'Cardano',
    logo: 'C',
    description: 'Native Layer 1 blockchain powering all agent transactions with unmatched security.',
    color: '#0033AD',
  },
  {
    name: 'Aiken',
    logo: 'A',
    description: 'Smart contract language enabling efficient on-chain agent logic and validators.',
    color: '#FF6B6B',
  },
  {
    name: 'Masumi',
    logo: 'M',
    description: 'AI agent framework providing the intelligent decision-making backbone.',
    color: '#6A00FF',
  },
  {
    name: 'Minswap',
    logo: 'MIN',
    description: 'Primary DEX integration for swap execution and liquidity access.',
    color: '#00D1FF',
  },
  {
    name: 'SundaeSwap',
    logo: 'SS',
    description: 'Additional DEX routing for optimal swap prices and deeper liquidity.',
    color: '#9945FF',
  },
  {
    name: 'Liqwid',
    logo: 'LQ',
    description: 'Lending protocol integration for yield strategies and leverage.',
    color: '#23F5A3',
  },
];

function IntegrationCard({ integration, index }: { integration: typeof integrations[0]; index: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="relative group"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      viewport={{ once: true }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      {/* Card */}
      <motion.div
        className="glass-card p-6 flex flex-col items-center justify-center cursor-pointer h-32"
        whileHover={{ 
          y: -5,
          boxShadow: `0 20px 40px ${integration.color}20`,
        }}
      >
        {/* Logo */}
        <motion.div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold font-heading mb-3"
          style={{ 
            backgroundColor: `${integration.color}20`,
            color: integration.color,
          }}
          animate={{
            scale: isHovered ? 1.1 : 1,
            boxShadow: isHovered ? `0 0 30px ${integration.color}40` : 'none',
          }}
        >
          {integration.logo}
        </motion.div>

        {/* Name */}
        <span className="text-sm font-medium text-foam-white">{integration.name}</span>
      </motion.div>

      {/* Tooltip Modal */}
      <motion.div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-4 glass-card z-50 pointer-events-none"
        initial={{ opacity: 0, y: 10, scale: 0.9 }}
        animate={{
          opacity: isHovered ? 1 : 0,
          y: isHovered ? 0 : 10,
          scale: isHovered ? 1 : 0.9,
        }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold font-heading"
            style={{ 
              backgroundColor: `${integration.color}20`,
              color: integration.color,
            }}
          >
            {integration.logo}
          </div>
          <span className="font-medium text-foam-white">{integration.name}</span>
        </div>
        <p className="text-xs text-sea-mist/80 leading-relaxed">
          {integration.description}
        </p>
        {/* Arrow */}
        <div 
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 glass-card"
        />
      </motion.div>
    </motion.div>
  );
}

export default function Integrations() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section ref={sectionRef} className="section relative overflow-hidden">
      {/* Background */}
      <div 
        className="absolute top-1/2 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(0, 180, 216, 0.08) 0%, transparent 70%)',
        }}
      />

      <div className="container">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <span className="text-sm text-aqua-glow uppercase tracking-widest font-medium mb-4 block">
            Ecosystem
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-foam-white font-heading mb-6">
            Powered by{' '}
            <span className="gradient-text">Best-in-Class</span>
          </h2>
          <p className="text-sea-mist/80 max-w-2xl mx-auto text-lg">
            Seamlessly integrated with Cardano's leading protocols and infrastructure
          </p>
        </motion.div>

        {/* Integration Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {integrations.map((integration, index) => (
            <IntegrationCard key={integration.name} integration={integration} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
