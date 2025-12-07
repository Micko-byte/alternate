import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import productTee from "@/assets/product-tee.jpg";
import productHoodie from "@/assets/product-hoodie.jpg";
import productPants from "@/assets/product-pants.jpg";

const products = [
  {
    id: 1,
    name: "Roots Graphic Tee",
    price: "UGX 45,000",
    image: productTee,
    tag: "New Drop",
  },
  {
    id: 2,
    name: "Bolt Oversized Hoodie",
    price: "UGX 85,000",
    image: productHoodie,
    tag: "Best Seller",
  },
  {
    id: 3,
    name: "Urban Cargo Pants",
    price: "UGX 65,000",
    image: productPants,
    tag: "Limited",
  },
];

const FeaturedDrops = () => {
  return (
    <section id="drops" className="py-20 md:py-32 bg-secondary/30">
      <div className="container px-4 md:px-6">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
          <div>
            <p className="text-primary text-sm uppercase tracking-widest mb-4">
              Fresh Off The Line
            </p>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-foreground">
              LATEST DROPS
            </h2>
          </div>
          <Button variant="outline" className="mt-6 md:mt-0">
            View All
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Products Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {products.map((product, index) => (
            <div
              key={product.id}
              className="group cursor-pointer animate-fade-up"
              style={{ animationDelay: `${index * 0.15}s` }}
            >
              {/* Image Container */}
              <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-card mb-4">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Tag */}
                <div className="absolute top-4 left-4 bg-primary text-primary-foreground text-xs font-display tracking-wider px-3 py-1 rounded">
                  {product.tag}
                </div>
                {/* Quick Add Overlay */}
                <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <Button variant="hero" size="lg">
                    Quick Add
                  </Button>
                </div>
              </div>

              {/* Product Info */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Streetwear Essential
                  </p>
                </div>
                <p className="font-display text-lg text-primary">
                  {product.price}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedDrops;
