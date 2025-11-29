import HeroSection from "../components/HeroSection";
import HowItWorks from "../components/HowItWorks";
import Footer from "../components/Footer";

// Wave separator component for fluid section boundaries
function WaveSeparator({ flip = false }: { flip?: boolean }) {
  return (
    <div className={`relative h-24 overflow-hidden ${flip ? 'rotate-180' : ''}`}>
      <svg
        className="absolute bottom-0 w-full h-full"
        viewBox="0 0 1440 100"
        preserveAspectRatio="none"
      >
        <path
          d="M0,40 C200,80 400,20 600,50 C800,80 1000,30 1200,60 C1350,80 1400,50 1440,60 L1440,100 L0,100 Z"
          fill="rgba(8, 145, 178, 0.03)"
        />
        <path
          d="M0,60 C240,30 480,80 720,50 C960,20 1200,70 1440,40 L1440,100 L0,100 Z"
          fill="rgba(34, 211, 238, 0.02)"
        />
      </svg>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="relative">
      <HeroSection />
      <WaveSeparator />
      <div id="how-it-works">
        <HowItWorks />
      </div>
      <WaveSeparator flip />
      <Footer />
    </main>
  );
}
