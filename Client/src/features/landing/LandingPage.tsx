import Navbar from './Navbar';
import HeroSection from './HeroSection';
import InnovationScoreSection from './InnovationScoreSection';
import EcosystemSection from './EcosystemSection';
import SocialProof from './SocialProof';
import FinalCTA from './FinalCTA';
import Footer from './Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Navbar />
      <main>
        <HeroSection />
        <InnovationScoreSection />
        <EcosystemSection />
        <SocialProof />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
