import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Target, Users, Zap, Heart, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--neon-lime) / 0.3) 1px, transparent 1px),
                               linear-gradient(90deg, hsl(var(--neon-lime) / 0.3) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />
        </div>
        <div className="container relative z-10 px-4 md:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block text-xs uppercase tracking-[0.3em] text-primary mb-4">
              Our Story
            </span>
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl mb-6">
              WE ARE{" "}
              <span className="text-gradient text-neon-glow">ALTERNATE</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              A digital-first lifestyle brand redefining streetwear for the Ugandan youth.
            </p>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-20 bg-secondary/30">
        <div className="container px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-4xl md:text-5xl text-center mb-12">
              THE <span className="text-neon-pink">PROBLEM</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-card border border-border rounded-lg p-8">
                <h3 className="font-display text-2xl text-neon-yellow mb-4">OPTION A: OWINO</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="text-neon-pink">✗</span>
                    Hours of digging through piles
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-neon-pink">✗</span>
                    Inconsistent sizing & quality
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-neon-pink">✗</span>
                    Second-hand, worn items
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-neon-pink">✗</span>
                    "Lucky finds" are rare
                  </li>
                </ul>
              </div>
              <div className="bg-card border border-border rounded-lg p-8">
                <h3 className="font-display text-2xl text-neon-cyan mb-4">OPTION B: BOUTIQUE</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="text-neon-pink">✗</span>
                    High quality, but premium prices
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-neon-pink">✗</span>
                    Out of reach for average 22-year-old
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-neon-pink">✗</span>
                    Limited to mall locations
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-neon-pink">✗</span>
                    Same styles everyone else has
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Solution */}
      <section className="py-20">
        <div className="container px-4 md:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-display text-4xl md:text-5xl mb-6">
              THE <span className="text-primary text-neon-glow">SOLUTION</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              We offer the exclusivity and "freshness" of a boutique brand at a price 
              point that rivals the "First Grade" section of Owino.
            </p>
            <div className="bg-gradient-to-br from-primary/10 to-neon-pink/10 border border-primary/30 rounded-2xl p-8 md:p-12">
              <p className="font-display text-3xl md:text-4xl text-foreground mb-4">
                "WE SELL DIGNITY AND IDENTITY AT AN AFFORDABLE PRICE"
              </p>
              <p className="text-muted-foreground">
                Alternate is not just a clothing line — it's a movement.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-secondary/30">
        <div className="container px-4 md:px-6">
          <h2 className="font-display text-4xl md:text-5xl text-center mb-16">
            OUR <span className="text-neon-yellow">VALUES</span>
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              {
                icon: Target,
                title: "Limited Drops",
                description: "Every piece is exclusive. When it's gone, it's gone.",
                color: "text-primary",
              },
              {
                icon: Users,
                title: "Artist-Designed",
                description: "Collaborations with local creatives keep designs fresh.",
                color: "text-neon-pink",
              },
              {
                icon: Zap,
                title: "Digital First",
                description: "Built for your phone. Shop anywhere, anytime.",
                color: "text-neon-yellow",
              },
              {
                icon: Heart,
                title: "Community",
                description: "More than customers — you're part of the culture.",
                color: "text-neon-cyan",
              },
            ].map((value, index) => (
              <div
                key={value.title}
                className="bg-card border border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors"
              >
                <value.icon className={`w-10 h-10 ${value.color} mx-auto mb-4`} />
                <h3 className="font-display text-xl mb-2">{value.title}</h3>
                <p className="text-sm text-muted-foreground">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Warehouse */}
      <section className="py-20">
        <div className="container px-4 md:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4 block">
              Powered By
            </span>
            <h2 className="font-display text-4xl md:text-5xl mb-6">
              WAREHOUSE <span className="text-primary">INVESTMENTS</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              By leveraging the Warehouse infrastructure to bring production in-house 
              and utilizing a direct-to-consumer web platform, we bypass the inefficiencies 
              of traditional retail and pass the savings to you.
            </p>
            <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto">
              <div className="text-center">
                <p className="font-display text-3xl text-primary">100%</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">In-House</p>
              </div>
              <div className="text-center">
                <p className="font-display text-3xl text-neon-pink">D2C</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Model</p>
              </div>
              <div className="text-center">
                <p className="font-display text-3xl text-neon-yellow">0</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Middlemen</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-primary/10 to-neon-pink/10">
        <div className="container px-4 md:px-6 text-center">
          <h2 className="font-display text-4xl md:text-5xl mb-6">
            READY TO JOIN THE <span className="text-primary text-neon-glow">MOVEMENT</span>?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Don't miss the next drop. Limited pieces, unlimited style.
          </p>
          <Link to="/">
            <Button variant="hero" size="xl">
              Shop Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
