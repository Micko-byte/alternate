import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import heroImage from "@/assets/hero-model.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-hero-gradient">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Alternate streetwear model in urban Kampala setting"
          className="w-full h-full object-cover object-center opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />
      </div>

      {/* Content */}
      <div className="container relative z-10 px-4 md:px-6 pt-20">
        <div className="max-w-3xl">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/50 backdrop-blur-sm rounded-full mb-6 animate-fade-up"
            style={{ animationDelay: "0.1s" }}
          >
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Limited Edition Drops
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-none mb-6 animate-fade-up"
            style={{ animationDelay: "0.2s" }}
          >
            <span className="block text-foreground">DRESS</span>
            <span className="block text-gradient">DIFFERENT.</span>
            <span className="block text-foreground">PAY LESS.</span>
          </h1>

          {/* Subheadline */}
          <p
            className="text-lg md:text-xl text-muted-foreground max-w-xl mb-8 leading-relaxed animate-fade-up"
            style={{ animationDelay: "0.4s" }}
          >
            Limited-edition streetwear designed for the Ugandan youth. Boutique
            freshness at Owino prices. This is your{" "}
            <span className="text-primary">alternate</span> reality.
          </p>

          {/* CTA Buttons */}
          <div
            className="flex flex-col sm:flex-row gap-4 animate-fade-up"
            style={{ animationDelay: "0.6s" }}
          >
            <Button variant="hero" size="xl">
              Shop The Drop
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="hero-outline" size="xl">
              Our Story
            </Button>
          </div>

          {/* Stats */}
          <div
            className="flex gap-8 md:gap-12 mt-12 pt-8 border-t border-border/30 animate-fade-up"
            style={{ animationDelay: "0.8s" }}
          >
            <div>
              <p className="font-display text-3xl md:text-4xl text-primary">
                50K+
              </p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
                Community
              </p>
            </div>
            <div>
              <p className="font-display text-3xl md:text-4xl text-primary">
                24
              </p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
                Exclusive Pieces
              </p>
            </div>
            <div>
              <p className="font-display text-3xl md:text-4xl text-primary">
                UGX 35K
              </p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
                Starting From
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-primary rounded-full" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
