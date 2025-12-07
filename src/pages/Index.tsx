import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import MarqueeStrip from "@/components/MarqueeStrip";
import ProblemSolution from "@/components/ProblemSolution";
import FeaturedDrops from "@/components/FeaturedDrops";
import Newsletter from "@/components/Newsletter";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <MarqueeStrip />
      <ProblemSolution />
      <FeaturedDrops />
      <Newsletter />
      <Footer />
    </main>
  );
};

export default Index;
