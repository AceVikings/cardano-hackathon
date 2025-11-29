import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

// Optimized Ocean Particle Shader Material
const FlowParticleMaterial = shaderMaterial(
  {
    uTime: 0,
  },
  // Vertex Shader - Simple but effective
  `
    uniform float uTime;
    attribute float aScale;
    attribute float aSpeed;
    attribute float aOffset;
    
    varying vec3 vColor;
    varying float vOpacity;
    
    void main() {
      vec3 pos = position;
      float time = uTime * aSpeed;
      
      // Simple flowing motion
      pos.y = mod(pos.y + time * 0.3 + 15.0, 30.0) - 15.0;
      pos.x += sin(time + aOffset) * 0.5 + sin(pos.y * 0.2 + time * 0.5) * 0.3;
      pos.z += cos(time * 0.8 + aOffset) * 0.3;
      
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Size attenuation
      gl_PointSize = aScale * (200.0 / -mvPosition.z);
      gl_PointSize = clamp(gl_PointSize, 1.0, 30.0);
      
      // Color based on height
      float heightFactor = (pos.y + 15.0) / 30.0;
      vec3 deepColor = vec3(0.035, 0.45, 0.55);
      vec3 brightColor = vec3(0.133, 0.827, 0.933);
      vColor = mix(deepColor, brightColor, heightFactor);
      
      // Depth-based opacity
      float depth = -mvPosition.z;
      vOpacity = 0.4 * smoothstep(25.0, 5.0, depth) * (0.6 + heightFactor * 0.4);
    }
  `,
  // Fragment Shader - Simple soft particle
  `
    varying vec3 vColor;
    varying float vOpacity;
    
    void main() {
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      
      float alpha = smoothstep(0.5, 0.1, dist) * vOpacity;
      gl_FragColor = vec4(vColor, alpha);
    }
  `
);

extend({ FlowParticleMaterial });

// Type declaration for the custom material
declare module '@react-three/fiber' {
  interface ThreeElements {
    flowParticleMaterial: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      ref?: React.Ref<any>;
      uTime?: number;
      uDepthColor?: THREE.Color;
      uSurfaceColor?: THREE.Color;
      uGlowColor?: THREE.Color;
      uFogNear?: number;
      uFogFar?: number;
      transparent?: boolean;
      depthWrite?: boolean;
      blending?: THREE.Blending;
    };
  }
}

// Light Rays / God Rays Component
function LightRays() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 8, -10]} rotation={[0.3, 0, 0]}>
      <planeGeometry args={[30, 20, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          varying vec2 vUv;
          
          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
              f.y
            );
          }
          
          void main() {
            vec2 uv = vUv;
            
            // Create multiple light shafts
            float rays = 0.0;
            
            for (float i = 0.0; i < 5.0; i++) {
              float offset = i * 0.17 + 0.1;
              float width = 0.08 + noise(vec2(uTime * 0.1 + i, 0.0)) * 0.04;
              float rayX = offset + sin(uTime * 0.2 + i * 1.5) * 0.05;
              
              // Soft ray shape
              float ray = smoothstep(width, 0.0, abs(uv.x - rayX));
              
              // Fade at top and bottom
              ray *= smoothstep(0.0, 0.3, uv.y) * smoothstep(1.0, 0.5, uv.y);
              
              // Animated intensity
              float flicker = 0.7 + 0.3 * sin(uTime * (1.0 + i * 0.5) + i);
              ray *= flicker;
              
              // Caustic-like variation
              float caustic = noise(vec2(uv.x * 10.0 + uTime * 0.5, uv.y * 5.0 + i));
              ray *= 0.7 + caustic * 0.5;
              
              rays += ray * (0.5 + i * 0.1);
            }
            
            rays = clamp(rays, 0.0, 1.0);
            
            // Light color gradient
            vec3 lightColor = mix(
              vec3(0.035, 0.569, 0.698),
              vec3(0.282, 0.792, 0.894),
              uv.y
            );
            
            gl_FragColor = vec4(lightColor, rays * 0.15);
          }
        `}
      />
    </mesh>
  );
}

// Realistic Underwater Particles Component
function FlowingParticles({ count = 800 }) {
  const meshRef = useRef<THREE.Points>(null);
  const materialRef = useRef<any>(null);

  const { positions, scales, speeds, offsets, types } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const speeds = new Float32Array(count);
    const offsets = new Float32Array(count);
    const types = new Float32Array(count);

    // Distribution: 40% sediment, 50% plankton, 10% debris
    const sedimentCount = Math.floor(count * 0.4);
    const planktonCount = Math.floor(count * 0.5);

    for (let i = 0; i < count; i++) {
      // Distribute in a larger volume with depth variation
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.pow(Math.random(), 0.7) * 12 + 1; // More particles near center
      const depth = Math.random() * 20 - 5; // Depth variation
      
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 2] = Math.sin(angle) * radius * 0.6 + depth;

      // Assign type and properties based on distribution
      if (i < sedimentCount) {
        // Sediment: tiny, slow
        types[i] = 0;
        scales[i] = Math.random() * 4 + 2;
        speeds[i] = Math.random() * 0.15 + 0.05;
      } else if (i < sedimentCount + planktonCount) {
        // Plankton: small, medium speed, glowy
        types[i] = 1;
        scales[i] = Math.random() * 8 + 4;
        speeds[i] = Math.random() * 0.4 + 0.15;
      } else {
        // Debris: larger, slower
        types[i] = 2;
        scales[i] = Math.random() * 12 + 8;
        speeds[i] = Math.random() * 0.1 + 0.05;
      }

      offsets[i] = Math.random() * Math.PI * 2;
    }

    return { positions, scales, speeds, offsets, types };
  }, [count]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uTime = state.clock.elapsedTime;
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[scales, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
        <bufferAttribute attach="attributes-aOffset" args={[offsets, 1]} />
        <bufferAttribute attach="attributes-aType" args={[types, 1]} />
      </bufferGeometry>
      <flowParticleMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Realistic Bubble Component with physics
function Bubbles({ count = 80 }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const bubbleData = useMemo(() => {
    return Array.from({ length: count }, () => {
      const baseScale = Math.random();
      return {
        x: (Math.random() - 0.5) * 20,
        y: Math.random() * 30 - 15,
        z: (Math.random() - 0.5) * 15 - 5,
        // Smaller bubbles are more common
        scale: Math.pow(baseScale, 2) * 0.2 + 0.03,
        // Smaller bubbles rise slower (realistic physics)
        speed: (0.15 + Math.pow(baseScale, 0.5) * 0.4),
        wobbleFreq: 1.5 + Math.random() * 2,
        wobbleAmp: 0.1 + Math.random() * 0.15,
        phase: Math.random() * Math.PI * 2,
        // Some bubbles merge/split - size oscillation
        pulseSpeed: 2 + Math.random() * 3,
        pulseAmp: 0.05 + Math.random() * 0.1,
      };
    });
  }, [count]);

  useFrame((state) => {
    if (!meshRef.current) return;

    const t = state.clock.elapsedTime;

    bubbleData.forEach((bubble, i) => {
      // Realistic rising with acceleration near surface
      const rawY = bubble.y + t * bubble.speed;
      const y = ((rawY + 15) % 30) - 15;
      
      // Surface approach causes faster rise and more wobble
      const surfaceProximity = Math.max(0, (y + 5) / 10);
      const speedBoost = 1 + surfaceProximity * 0.5;
      
      // Helical path (bubbles spiral as they rise)
      const spiralAngle = t * bubble.wobbleFreq + bubble.phase + y * 0.3;
      const wobbleRadius = bubble.wobbleAmp * (1 + surfaceProximity * 0.5);
      const wobbleX = Math.sin(spiralAngle) * wobbleRadius;
      const wobbleZ = Math.cos(spiralAngle) * wobbleRadius * 0.7;
      
      // Bubbles expand as they rise (pressure change)
      const depthScale = 1 + surfaceProximity * 0.3;
      // Pulsing effect (surface tension)
      const pulse = 1 + Math.sin(t * bubble.pulseSpeed + bubble.phase) * bubble.pulseAmp;
      
      dummy.position.set(
        bubble.x + wobbleX,
        y * speedBoost,
        bubble.z + wobbleZ
      );
      dummy.scale.setScalar(bubble.scale * depthScale * pulse);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 24, 24]} />
      <meshPhysicalMaterial
        color="#48cae4"
        transparent
        opacity={0.12}
        roughness={0}
        metalness={0}
        transmission={0.95}
        thickness={0.3}
        ior={1.33} // Water's index of refraction
        clearcoat={1}
        clearcoatRoughness={0}
        envMapIntensity={0.5}
      />
    </instancedMesh>
  );
}

// Optimized Flow Agent Node - Simplified but visually striking
function FlowNode({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    
    if (groupRef.current) {
      // Gentle floating motion
      groupRef.current.position.y = position[1] + Math.sin(t * 0.8) * 0.15;
    }
    
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.5;
      const pulse = 1 + Math.sin(t * 2) * 0.1;
      coreRef.current.scale.setScalar(scale * 0.3 * pulse);
    }
    
    if (ringRef.current) {
      ringRef.current.rotation.x = t * 0.8;
      ringRef.current.rotation.z = t * 0.4;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Outer glow */}
      <mesh scale={scale * 0.6}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.08} />
      </mesh>
      
      {/* Core */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#14f0b5" transparent opacity={0.9} />
      </mesh>
      
      {/* Single energy ring */}
      <mesh ref={ringRef} scale={scale}>
        <torusGeometry args={[0.45, 0.015, 8, 32]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.7} />
      </mesh>
      
      {/* Point light */}
      <pointLight color="#14f0b5" intensity={1} distance={3} />
    </group>
  );
}

// Camera Controller with subtle drift
function CameraController() {
  const { camera } = useThree();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Gentle underwater sway
    const swayX = Math.sin(t * 0.3) * 0.3 + state.pointer.x * 0.4;
    const swayY = Math.cos(t * 0.2) * 0.2 + state.pointer.y * 0.3;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, swayX, 0.02);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, swayY, 0.02);
    camera.lookAt(0, 0, -3);
  });

  return null;
}

// 3D Scene - Optimized
function Scene() {
  return (
    <>
      <color attach="background" args={['#020a14']} />
      <fog attach="fog" args={['#020a14', 5, 25]} />
      <ambientLight intensity={0.15} color="#22d3ee" />
      <directionalLight position={[5, 10, 5]} intensity={0.2} color="#f0fdff" />

      <CameraController />

      {/* Light Rays from above */}
      <LightRays />

      {/* Flow Nodes - 5 agent orbs */}
      <FlowNode position={[-3.5, 1.5, -3]} scale={1.3} />
      <FlowNode position={[0, 2.5, -2]} scale={1.1} />
      <FlowNode position={[3.5, 1, -3]} scale={1.2} />
      <FlowNode position={[-2, -0.5, -2]} scale={0.9} />
      <FlowNode position={[2, 0.5, -2.5]} scale={1} />

      {/* Flowing Particles - optimized count */}
      <FlowingParticles count={400} />

      {/* Bubbles - reduced */}
      <Bubbles count={30} />
    </>
  );
}

// Hero Section Component
export default function HeroSection() {
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.25, 0.8, 0.25, 1] as const,
      },
    },
  };

  const flowVariants = {
    hidden: { backgroundPosition: '0% 50%' },
    visible: {
      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: 'linear' as const,
      },
    },
  };

  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      {/* SVG Filter for melt effects */}
      <svg className="absolute w-0 h-0">
        <defs>
          <filter id="melt-filter">
            <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* 3D Canvas Background */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 6], fov: 55 }}>
          <Scene />
        </Canvas>
      </div>

      {/* Underwater Light Rays */}
      <div className="absolute inset-0 z-5 pointer-events-none overflow-hidden">
        <div 
          className="absolute top-0 left-1/4 w-1 h-full opacity-10"
          style={{
            background: 'linear-gradient(180deg, #22d3ee 0%, transparent 80%)',
            filter: 'blur(40px)',
            transform: 'rotate(15deg) scaleX(8)',
          }}
        />
        <div 
          className="absolute top-0 right-1/3 w-1 h-full opacity-8"
          style={{
            background: 'linear-gradient(180deg, #0891b2 0%, transparent 70%)',
            filter: 'blur(50px)',
            transform: 'rotate(-10deg) scaleX(10)',
          }}
        />
      </div>

      {/* Gradient Overlay - Deep ocean fade */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-deep-ocean/30 to-deep-ocean z-10 pointer-events-none" />
      
      {/* Radial Gradient Orb - Bioluminescent glow */}
      <div 
        className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full z-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(8, 145, 178, 0.12) 0%, rgba(34, 211, 238, 0.05) 40%, transparent 70%)',
        }}
      />

      {/* Content */}
      <div className="relative z-20 container mx-auto px-6 lg:px-12 min-h-screen flex items-center">
        <motion.div
          className="max-w-3xl"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-abyss/70 backdrop-blur-xl border border-current-blue/30 text-xs font-medium text-aqua-glow uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-bioluminescent animate-pulse" />
              Live on Cardano Mainnet
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6 font-heading"
          >
            <span className="text-foam-white">Autonomous Finance.</span>
            <br />
            <motion.span
              className="gradient-text inline-block"
              style={{
                backgroundSize: '200% 200%',
              }}
              variants={flowVariants}
              animate="visible"
            >
              Powered by Agents.
            </motion.span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl max-w-xl mb-10 leading-relaxed text-sea-mist"
          >
            Let intelligent agents manage your DeFi actions on Cardano — safely, transparently & continuously.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={itemVariants} className="flex flex-wrap gap-4">
            <motion.button
              className="liquid-btn px-8 py-3.5 font-heading font-semibold text-sm uppercase tracking-wider text-foam-white bg-gradient-to-br from-current-blue to-aqua-glow rounded-xl cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/login')}
            >
              <span className="relative z-10">Launch App</span>
            </motion.button>
            <motion.button
              className="ripple px-8 py-3.5 font-heading font-semibold text-sm uppercase tracking-wider text-sea-mist bg-transparent border border-current-blue/40 rounded-xl cursor-pointer transition-all duration-400 hover:text-foam-white hover:border-aqua-glow hover:shadow-[0_0_30px_rgba(34,211,238,0.2)]"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Explore Agents
            </motion.button>
          </motion.div>

          {/* Stats */}
          <motion.div
            variants={itemVariants}
            className="mt-16 grid grid-cols-3 gap-8 max-w-lg"
          >
            {[
              { value: '$2.4M', label: 'Total Value Locked' },
              { value: '15K+', label: 'Active Agents' },
              { value: '99.9%', label: 'Uptime' },
            ].map((stat) => (
              <div key={stat.label} className="melt-hover">
                <div className="text-2xl md:text-3xl font-bold text-foam-white font-heading">
                  {stat.value}
                </div>
                <div className="text-xs text-sea-mist/60 uppercase tracking-wider mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll Indicator - Bubble style */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.8 }}
      >
        <motion.div
          className="w-8 h-12 rounded-full border border-current-blue/40 flex items-start justify-center p-2 backdrop-blur-sm bg-abyss/30"
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.div
            className="w-2 h-2 rounded-full bg-aqua-glow"
            animate={{ y: [0, 16, 0], opacity: [1, 0.4, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </motion.div>

      {/* Wave Divider at bottom */}
      <div className="absolute bottom-0 left-0 w-full h-20 z-15 pointer-events-none overflow-hidden">
        <svg 
          className="absolute bottom-0 w-[200%] h-full"
          viewBox="0 0 1440 100" 
          preserveAspectRatio="none"
          style={{ animation: 'wave-flow 15s linear infinite' }}
        >
          <path 
            d="M0,50 C360,100 720,0 1080,50 C1260,75 1350,25 1440,50 L1440,100 L0,100 Z"
            fill="rgba(8, 145, 178, 0.1)"
          />
        </svg>
        <svg 
          className="absolute bottom-0 w-[200%] h-full"
          viewBox="0 0 1440 100" 
          preserveAspectRatio="none"
          style={{ animation: 'wave-flow 12s linear infinite', animationDelay: '-5s' }}
        >
          <path 
            d="M0,60 C360,20 720,80 1080,40 C1260,20 1350,60 1440,40 L1440,100 L0,100 Z"
            fill="rgba(34, 211, 238, 0.08)"
          />
        </svg>
      </div>
    </section>
  );
}
