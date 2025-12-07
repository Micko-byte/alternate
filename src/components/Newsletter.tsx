import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";

const Newsletter = () => {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      toast.success("Welcome to the Alternate fam!", {
        description: "You'll be first to know about our drops.",
      });
      setEmail("");
    }
  };

  return (
    <section className="py-20 md:py-32 bg-background relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />

      <div className="container px-4 md:px-6 relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/50 backdrop-blur-sm rounded-full mb-6">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Join The Movement
            </span>
          </div>

          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-foreground mb-6">
            GET EARLY ACCESS
          </h2>

          <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">
            Be the first to cop limited drops. Join 50,000+ young Ugandans who
            refuse to dress boring.
          </p>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto"
          >
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 h-14 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              required
            />
            <Button type="submit" variant="hero" size="xl">
              Join
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-4">
            No spam. Just fire drops and exclusive content.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Newsletter;
