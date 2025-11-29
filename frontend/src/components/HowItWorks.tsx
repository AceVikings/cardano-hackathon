import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Wallet, Bot, Zap } from "lucide-react";

const steps = [
  {
    icon: Wallet,
    number: "01",
    title: "Connect Wallet",
    description:
      "Link your Eternl wallet securely using cryptographic signature verification. No passwords, no seed phrases shared.",
    gradient: "from-current-blue to-aqua-glow",
  },
  {
    icon: Bot,
    number: "02",
    title: "Choose Agent Strategy",
    description:
      "Select from our curated suite of AI agents optimized for swaps, yield farming, risk management, and arbitrage.",
    gradient: "from-aqua-glow to-bioluminescent",
  },
  {
    icon: Zap,
    number: "03",
    title: "Automation Activates",
    description:
      "Your agents spring into action, executing strategies 24/7 while you maintain full control and transparency.",
    gradient: "from-bioluminescent to-current-blue",
  },
];

function StepCard({ step, index }: { step: (typeof steps)[0]; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const Icon = step.icon;

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
      className="relative group"
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

      {/* Card */}
      <motion.div
        className="bg-abyss/40 backdrop-blur-lg border border-current-blue/20 rounded-2xl p-8 relative overflow-hidden h-full"
        whileHover={{
          y: -8,
          boxShadow: "0 20px 60px rgba(8, 145, 178, 0.2)",
        }}
        transition={{ duration: 0.3 }}
      >
        {/* Gradient border glow on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, rgba(8, 145, 178, 0.1), rgba(34, 211, 238, 0.1))`,
          }}
        />

        {/* Step Number */}
        <div className="text-6xl font-bold text-foam-white/5 absolute top-4 right-4 font-heading">
          {step.number}
        </div>

        {/* Icon */}
        <motion.div
          className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mb-6 relative`}
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Icon className="w-8 h-8 text-foam-white" />
          {/* Glow */}
          <div
            className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${step.gradient} blur-xl opacity-50`}
          />
        </motion.div>

        {/* Content */}
        <h3 className="text-xl font-bold text-foam-white mb-3 font-heading">
          {step.title}
        </h3>
        <p className="text-sea-mist/80 leading-relaxed">
          {step.description}
        </p>

        {/* Bottom accent line */}
        <motion.div
          className={`absolute bottom-0 left-0 h-1 bg-gradient-to-r ${step.gradient}`}
          initial={{ width: 0 }}
          whileHover={{ width: "100%" }}
          transition={{ duration: 0.5 }}
        />
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
      className="flex flex-col items-center justify-center relative overflow-hidden"
    >
      {/* Background Elements */}
      <div
        className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(34, 211, 238, 0.08) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(8, 145, 178, 0.08) 0%, transparent 70%)",
        }}
      />

      <div className="container">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.25, 0.8, 0.25, 1] }}
          className="text-center mb-20"
        >
          <span className="text-sm text-aqua-glow uppercase tracking-widest font-medium mb-4 block">
            Getting Started
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-foam-white font-heading mb-6">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="text-sea-mist/80 max-w-2xl mx-auto text-lg">
            Three simple steps to unlock the power of autonomous finance on
            Cardano
          </p>
        </motion.div>

        {/* Steps Grid */}
        <div className="grid lg:grid-cols-3 gap-8 relative">
          {steps.map((step, index) => (
            <StepCard key={step.number} step={step} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
