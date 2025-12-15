import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? "bg-background/90 backdrop-blur-lg border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <span className="font-display text-2xl md:text-3xl tracking-wider text-foreground">
              ALTERNATE
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#drops"
              className="text-sm uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
            >
              Drops
            </a>
            <Link
              to="/design"
              className="text-sm uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
            >
              Create
            </Link>
            <Link
              to="/about"
              className="text-sm uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
            >
              About Us
            </Link>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:block">
            <Button variant="outline" size="sm">
              Join Waitlist
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-foreground p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-6 border-t border-border animate-fade-in">
            <nav className="flex flex-col gap-4">
              <a
                href="#drops"
                className="text-lg uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
              >
                Drops
              </a>
              <Link
                to="/design"
                className="text-lg uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Create Your Own
              </Link>
              <Link
                to="/about"
                className="text-lg uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                About Us
              </Link>
              <Button variant="outline" size="lg" className="mt-4">
                Join Waitlist
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
