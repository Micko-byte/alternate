import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Truck, Shield, RotateCcw } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductImageGallery from "@/components/ProductImageGallery";
import SizeSelector from "@/components/SizeSelector";
import ViewerCounter from "@/components/ViewerCounter";
import MobileMoneyCheckout from "@/components/MobileMoneyCheckout";

import productTee from "@/assets/product-tee.jpg";
import productHoodie from "@/assets/product-hoodie.jpg";
import productPants from "@/assets/product-pants.jpg";

// Product data (would come from API in production)
const products = [
  {
    id: 1,
    name: "JDM Drift Tee",
    price: "UGX 45,000",
    images: [productTee, productHoodie, productPants],
    tag: "New Drop",
    description: "Premium heavyweight cotton tee featuring exclusive JDM-inspired artwork. Limited edition design by local artists.",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    stock: 12,
  },
  {
    id: 2,
    name: "Kampala Heritage Tee",
    price: "UGX 45,000",
    images: [productHoodie, productTee, productPants],
    tag: "Best Seller",
    description: "Celebrate Kampala's rich culture with this heritage-inspired design. Soft cotton blend for all-day comfort.",
    sizes: ["XS", "S", "M", "L", "XL"],
    stock: 8,
  },
  {
    id: 3,
    name: "Island Vibes Tee",
    price: "UGX 45,000",
    images: [productPants, productTee, productHoodie],
    tag: "Limited",
    description: "Tropical-inspired graphics meet urban streetwear. Only 50 pieces made worldwide.",
    sizes: ["S", "M", "L", "XL"],
    stock: 5,
  },
];

const ProductDetails = () => {
  const { id } = useParams();
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const product = products.find((p) => p.id === Number(id)) || products[0];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-20">
        <div className="container px-4 md:px-6">
          {/* Back Link */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Drops</span>
          </Link>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Image Gallery */}
            <ProductImageGallery images={product.images} productName={product.name} />

            {/* Product Info */}
            <div className="space-y-6">
              {/* Tag */}
              <span className="inline-block bg-primary/20 text-primary text-xs font-display tracking-wider px-3 py-1 rounded">
                {product.tag}
              </span>

              {/* Title & Price */}
              <div>
                <h1 className="font-display text-3xl md:text-4xl text-foreground mb-2">
                  {product.name}
                </h1>
                <p className="font-display text-2xl text-primary glow-text">
                  {product.price}
                </p>
              </div>

              {/* Live Viewer Counter */}
              <ViewerCounter productId={product.id} />

              {/* Stock Warning */}
              <div className="bg-neon-pink/10 border border-neon-pink/30 rounded-lg px-4 py-3">
                <p className="text-neon-pink text-sm font-medium">
                  🔥 Only {product.stock} left in stock — order soon!
                </p>
              </div>

              {/* Description */}
              <p className="text-muted-foreground leading-relaxed">
                {product.description}
              </p>

              {/* Size Selector */}
              <SizeSelector
                sizes={product.sizes}
                selectedSize={selectedSize}
                onSizeSelect={setSelectedSize}
              />

              {/* Mobile Money Checkout */}
              <div className="border-t border-border pt-6">
                <MobileMoneyCheckout
                  productName={product.name}
                  price={product.price}
                  size={selectedSize}
                />
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="text-center">
                  <Truck className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Free Delivery</p>
                </div>
                <div className="text-center">
                  <Shield className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Secure Payment</p>
                </div>
                <div className="text-center">
                  <RotateCcw className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Easy Returns</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProductDetails;
