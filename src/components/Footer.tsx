import { Instagram, Twitter } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-card border-t border-border py-12">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          {/* Logo & Tagline */}
          <div className="text-center md:text-left">
            <span className="font-display text-3xl tracking-wider text-foreground">
              ALTERNATE
            </span>
            <p className="text-muted-foreground text-sm mt-2">
              Dignity & Identity. Affordable.
            </p>
          </div>

          {/* Links */}
          <nav className="flex gap-8">
            <a
              href="#drops"
              className="text-sm uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
            >
              Shop
            </a>
            <a
              href="#story"
              className="text-sm uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
            >
              Story
            </a>
            <a
              href="#"
              className="text-sm uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
            >
              Contact
            </a>
          </nav>

          {/* Social */}
          <div className="flex gap-4">
            <a
              href="#"
              className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <Instagram size={18} />
            </a>
            <a
              href="#"
              className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <Twitter size={18} />
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © 2024 Alternate by Warehouse Investments. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Made with love in Kampala 🇺🇬
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
