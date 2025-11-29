import { useRef, useState } from "react";
import { motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Wallet, Bot, Zap } from "lucide-react";

const steps = [
  {
    icon: Wallet,
    number: "01",
    title: "Connect Wallet",
    description:
      "Link your Eternl wallet securely using cryptographic signature verification. No passwords, no seed phrases shared.",
    gradient: "from-current-blue to-aqua-glow",
    glowColor: "rgba(8, 145, 178, 0.4)",
  },
  {
    icon: Bot,
    number: "02",
    title: "Choose Agent Strategy",
    description:
      "Select from our curated suite of AI agents optimized for swaps, yield farming, risk management, and arbitrage.",
    gradient: "from-aqua-glow to-bioluminescent",
    glowColor: "rgba(34, 211, 238, 0.4)",
  },
  {
    icon: Zap,
    number: "03",
    title: "Automation Activates",
    description:
      "Your agents spring into action, executing strategies 24/7 while you maintain full control and transparency.",
    gradient: "from-bioluminescent to-current-blue",
    glowColor: "rgba(110, 231, 183, 0.4)",
  },
];

function MeltingCard({ step, index }: { step: (typeof steps)[0]; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const Icon = step.icon;
  const [isHovered, setIsHovered] = useState(false);

  // Mouse position tracking for liquid effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth spring animations for natural feel
  const springConfig = { damping: 25, stiffness: 200 };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);

  // Transform mouse position to rotation
  const rotateX = useTransform(y, [-100, 100], [8, -8]);
  const rotateY = useTransform(x, [-100, 100], [-8, 8]);

  // Liquid blob position
  const blobX = useTransform(x, [-100, 100], [20, 80]);
  const blobY = useTransform(y, [-100, 100], [20, 80]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set(e.clientX - centerX);
    mouseY.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    setIsHovered(false);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 60 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.8,
        delay: index * 0.2,
        ease: [0.25, 0.8, 0.25, 1],
      }}
      className="relative group perspective-1000"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      {/* Connection Line */}
      {index < steps.length - 1 && (
        <div className="hidden lg:block absolute top-1/2 left-full w-full h-0.5 -translate-y-1/2 z-0">
          <motion.div
            className={`h-full bg-gradient-to-r ${step.gradient}`}
            initial={{ scaleX: 0 }}
            animate={isInView ? { scaleX: 1 } : {}}
            transition={{
              duration: 1,
              delay: index * 0.2 + 0.5,
              ease: [0.25, 0.8, 0.25, 1],
            }}
            style={{ transformOrigin: "left" }}
          />
        </div>
      )}

      {/* Card with 3D tilt and melt effect */}
      <motion.div
        className="relative overflow-hidden h-full rounded-3xl"
        style={{
          rotateX: isHovered ? rotateX : 0,
          rotateY: isHovered ? rotateY : 0,
          transformStyle: "preserve-3d",
        }}
        whileHover={{
          scale: 1.02,
          boxShadow: `0 25px 80px ${step.glowColor}`,
        }}
        transition={{ duration: 0.3 }}
      >
        {/* Melting liquid background effect */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isHovered
              ? `radial-gradient(circle at ${blobX.get()}% ${blobY.get()}%, ${step.glowColor} 0%, transparent 50%)`
              : 'transparent',
          }}
        />
        
        {/* Animated liquid blobs */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" preserveAspectRatio="none">
          <defs>
            <filter id={`goo-${index}`}>
              <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10" result="goo" />
              <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
            </filter>
            <linearGradient id={`meltGradient-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={step.glowColor.replace('0.4', '0.3')} />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
          
          {/* Multiple dripping/melting blobs */}
          <g filter={`url(#goo-${index})`} style={{ opacity: isHovered ? 1 : 0, transition: 'opacity 0.3s' }}>
            <motion.circle
              cx="30%"
              cy="10%"
              r={isHovered ? "80" : "0"}
              fill={`url(#meltGradient-${index})`}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
            <motion.circle
              cx="70%"
              cy="15%"
              r={isHovered ? "60" : "0"}
              fill={`url(#meltGradient-${index})`}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
            />
            <motion.circle
              cx="50%"
              cy="85%"
              r={isHovered ? "70" : "0"}
              fill={`url(#meltGradient-${index})`}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
            />
          </g>
        </svg>

        {/* Card background with glass morphism */}
        <div className="relative bg-abyss/60 backdrop-blur-xl border border-current-blue/20 rounded-3xl p-10 h-full transition-all duration-500 group-hover:border-current-blue/40 group-hover:bg-abyss/40">
          {/* Gradient border glow on hover */}
          <motion.div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.4 }}
            style={{
              background: `linear-gradient(135deg, ${step.glowColor.replace('0.4', '0.15')}, transparent 60%)`,
            }}
          />

          {/* Step Number - larger and more prominent */}
          <div className="text-7xl font-bold text-foam-white/[0.03] absolute top-6 right-6 font-heading select-none">
            {step.number}
          </div>

          {/* Floating Icon with enhanced glow */}
          <motion.div
            className={`w-18 h-18 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mb-8 relative z-10`}
            style={{ width: '4.5rem', height: '4.5rem' }}
            animate={{
              y: isHovered ? -4 : 0,
              scale: isHovered ? 1.1 : 1,
              rotate: isHovered ? 5 : 0,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Icon className="w-9 h-9 text-foam-white" />
            {/* Multi-layer glow */}
            <motion.div
              className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${step.gradient}`}
              animate={{
                opacity: isHovered ? 0.8 : 0.4,
                scale: isHovered ? 1.5 : 1.2,
              }}
              style={{ filter: 'blur(20px)', zIndex: -1 }}
              transition={{ duration: 0.4 }}
            />
            <motion.div
              className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${step.gradient}`}
              animate={{
                opacity: isHovered ? 0.4 : 0.2,
                scale: isHovered ? 2 : 1.5,
              }}
              style={{ filter: 'blur(40px)', zIndex: -2 }}
              transition={{ duration: 0.4 }}
            />
          </motion.div>

          {/* Content with better spacing */}
          <motion.h3 
            className="text-2xl font-bold text-foam-white mb-4 font-heading relative z-10"
            animate={{ x: isHovered ? 4 : 0 }}
            transition={{ duration: 0.3 }}
          >
            {step.title}
          </motion.h3>
          <motion.p 
            className="text-sea-mist/80 leading-relaxed text-base relative z-10"
            animate={{ x: isHovered ? 4 : 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            {step.description}
          </motion.p>

          {/* Bottom accent line with liquid animation */}
          <motion.div
            className={`absolute bottom-0 left-0 h-1.5 rounded-full bg-gradient-to-r ${step.gradient}`}
            initial={{ width: 0, opacity: 0 }}
            animate={{ 
              width: isHovered ? "100%" : "0%",
              opacity: isHovered ? 1 : 0,
            }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            style={{ filter: isHovered ? `drop-shadow(0 0 10px ${step.glowColor})` : 'none' }}
          />
          
          {/* Corner accent blobs */}
          <motion.div
            className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${step.glowColor.replace('0.4', '0.2')} 0%, transparent 70%)`,
            }}
            animate={{
              scale: isHovered ? 1.5 : 1,
              opacity: isHovered ? 1 : 0.3,
            }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function HowItWorks() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <section
      ref={sectionRef}
      className="flex flex-col items-center justify-center relative overflow-hidden py-24 lg:py-32"
    >
      {/* Background Elements */}
      <div
        className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(34, 211, 238, 0.06) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(8, 145, 178, 0.06) 0%, transparent 70%)",
        }}
      />
      
      {/* Floating ambient particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-aqua-glow/20"
            style={{
              left: `${10 + i * 12}%`,
              top: `${20 + (i % 4) * 20}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.5, 0.2],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: 4 + i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3,
            }}
          />
        ))}
      </div>

      <div className="container px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.25, 0.8, 0.25, 1] }}
          className="text-center mb-20 lg:mb-24"
        >
          <span className="text-sm text-aqua-glow uppercase tracking-widest font-medium mb-4 block">
            Getting Started
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foam-white font-heading mb-6">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="text-sea-mist/80 max-w-2xl mx-auto text-lg lg:text-xl">
            Three simple steps to unlock the power of autonomous finance on
            Cardano
          </p>
        </motion.div>

        {/* Steps Grid with improved gap */}
        <div className="grid lg:grid-cols-3 gap-8 lg:gap-10 relative max-w-7xl mx-auto">
          {steps.map((step, index) => (
            <MeltingCard key={step.number} step={step} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
