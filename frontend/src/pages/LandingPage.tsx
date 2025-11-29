import HeroSection from "../components/HeroSection";
import HowItWorks from "../components/HowItWorks";
import Footer from "../components/Footer";

// Seamless wave divider that connects sections without gaps
function WaveDivider({ flip = false }: { flip?: boolean }) {
  return (
    <div className={`relative w-full ${flip ? 'rotate-180' : ''}`} style={{ marginTop: flip ? '-1px' : '0', marginBottom: flip ? '0' : '-1px' }}>
      <svg
        className="block w-full"
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
        style={{ display: 'block', height: '60px' }}
      >
        <defs>
          <linearGradient id={`waveFill${flip ? 'Flip' : ''}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(8, 145, 178, 0.06)" />
            <stop offset="50%" stopColor="rgba(34, 211, 238, 0.08)" />
            <stop offset="100%" stopColor="rgba(8, 145, 178, 0.06)" />
          </linearGradient>
        </defs>
        
        {/* Single smooth wave */}
        <path
          d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,30 1440,40 L1440,80 L0,80 Z"
          fill={`url(#waveFill${flip ? 'Flip' : ''})`}
        />
        
        {/* Subtle accent line */}
        <path
          d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,30 1440,40"
          fill="none"
          stroke="rgba(34, 211, 238, 0.12)"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="relative">
      <HeroSection />
      <WaveDivider />
      <div id="how-it-works">
        <HowItWorks />
      </div>
      <WaveDivider flip />
      <Footer />
    </main>
  );
}
