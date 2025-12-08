import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProductImageGalleryProps {
  images: string[];
  productName: string;
}

const ProductImageGallery = ({ images, productName }: ProductImageGalleryProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-card border border-border">
        <img
          src={images[selectedIndex]}
          alt={productName}
          className="w-full h-full object-cover"
        />
        {/* Low Stock Badge */}
        <div className="absolute top-4 left-4 bg-neon-pink text-white text-xs font-display tracking-wider px-3 py-1 rounded animate-glow-pulse">
          LOW STOCK
        </div>
      </div>

      {/* Thumbnail Gallery */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-all duration-200",
                selectedIndex === index
                  ? "border-primary glow-neon"
                  : "border-border hover:border-primary/50"
              )}
            >
              <img
                src={image}
                alt={`${productName} view ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductImageGallery;
