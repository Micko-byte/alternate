import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import productTee from "@/assets/product-tee.jpg";
import productHoodie from "@/assets/product-hoodie.jpg";
import productPants from "@/assets/product-pants.jpg";

const products = [
  {
    id: 1,
    name: "JDM Drift Tee",
    price: "UGX 45,000",
    image: productTee,
    tag: "New Drop",
    stock: 12,
  },
  {
    id: 2,
    name: "Kampala Heritage Tee",
    price: "UGX 45,000",
    image: productHoodie,
    tag: "Best Seller",
    stock: 8,
  },
  {
    id: 3,
    name: "Island Vibes Tee",
    price: "UGX 45,000",
    image: productPants,
    tag: "Limited",
    stock: 5,
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
            <Link
              to={`/product/${product.id}`}
              key={product.id}
              className="group cursor-pointer animate-fade-up block"
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
                {/* Low Stock Badge */}
                {product.stock <= 10 && (
                  <div className="absolute top-4 right-4 bg-neon-pink text-white text-xs font-display tracking-wider px-2 py-1 rounded animate-glow-pulse">
                    {product.stock} LEFT
                  </div>
                )}
                {/* Quick Add Overlay */}
                <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <Button variant="hero" size="lg">
                    View Details
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
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedDrops;
