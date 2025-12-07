import { X, Check, Zap } from "lucide-react";

const ProblemSolution = () => {
  return (
    <section id="story" className="py-20 md:py-32 bg-background">
      <div className="container px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-primary text-sm uppercase tracking-widest mb-4">
            The Problem We Solve
          </p>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-foreground">
            WHY ALTERNATE EXISTS
          </h2>
        </div>

        {/* Cards Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Owino Card */}
          <div className="bg-card-gradient rounded-lg p-8 border border-border hover:border-destructive/50 transition-colors group">
            <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center mb-6">
              <X className="text-destructive" size={24} />
            </div>
            <h3 className="font-display text-2xl text-foreground mb-4">
              OPTION A: OWINO
            </h3>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-1">—</span>
                Hours of digging through piles
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-1">—</span>
                Inconsistent sizing
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-1">—</span>
                Quality is pure luck
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-1">—</span>
                Second-hand, not unique
              </li>
            </ul>
            <p className="mt-6 text-sm text-muted-foreground/60">
              Affordable, but at what cost?
            </p>
          </div>

          {/* Boutique Card */}
          <div className="bg-card-gradient rounded-lg p-8 border border-border hover:border-destructive/50 transition-colors group">
            <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center mb-6">
              <X className="text-destructive" size={24} />
            </div>
            <h3 className="font-display text-2xl text-foreground mb-4">
              OPTION B: BOUTIQUE
            </h3>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-1">—</span>
                High quality pieces
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-1">—</span>
                Cool and exclusive
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-1">—</span>
                Way too expensive
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-1">—</span>
                Not for the average 22-year-old
              </li>
            </ul>
            <p className="mt-6 text-sm text-muted-foreground/60">
              Fresh, but out of reach.
            </p>
          </div>

          {/* Alternate Card */}
          <div className="bg-gradient-to-br from-primary/20 to-card rounded-lg p-8 border-2 border-primary glow-amber transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-display tracking-wider px-4 py-1">
              THE SOLUTION
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-6">
              <Zap className="text-primary" size={24} />
            </div>
            <h3 className="font-display text-2xl text-foreground mb-4">
              ALTERNATE
            </h3>
            <ul className="space-y-3 text-foreground">
              <li className="flex items-start gap-2">
                <Check className="text-primary mt-1 shrink-0" size={16} />
                Boutique-level exclusivity
              </li>
              <li className="flex items-start gap-2">
                <Check className="text-primary mt-1 shrink-0" size={16} />
                Artist-designed limited drops
              </li>
              <li className="flex items-start gap-2">
                <Check className="text-primary mt-1 shrink-0" size={16} />
                Owino-friendly prices
              </li>
              <li className="flex items-start gap-2">
                <Check className="text-primary mt-1 shrink-0" size={16} />
                Fresh. New. Yours.
              </li>
            </ul>
            <p className="mt-6 text-sm text-primary font-medium">
              Dignity & identity at your price.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSolution;
