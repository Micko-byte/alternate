import { useState, useEffect } from "react";
import { Shirt, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DesignCanvasRef } from "./DesignCanvas";

interface MockupPreviewProps {
  canvasRef: DesignCanvasRef | null;
}

const tshirtColors = [
  { id: "black", name: "Black", hex: "#121212", image: "/mockups/heavy-cotton-black.png" },
  { id: "white", name: "White", hex: "#FFFFFF", image: "/mockups/heavy-cotton-white.png" },
  { id: "vintage-navy", name: "Navy", hex: "#1e293b", image: "/mockups/heavy-cotton-navy.png" },
];

const MockupPreview = ({ canvasRef }: MockupPreviewProps) => {
  const [tshirtColor, setTshirtColor] = useState(tshirtColors[0]);
  const [designImage, setDesignImage] = useState<string | null>(null);
  const [isFullView, setIsFullView] = useState(false);

  useEffect(() => {
    if (!canvasRef?.canvas) return;
    const updatePreview = () => setDesignImage(canvasRef.exportImage());
    
    // Listen for changes to auto-update mockup
    canvasRef.canvas.on("after:render", updatePreview);
    updatePreview();
    
    return () => {
      canvasRef.canvas.off("after:render", updatePreview);
    };
  }, [canvasRef]);

  return (
    <div className="flex flex-col h-full">
      {/* Header Area */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shirt className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Live Preview</span>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
            REAL-TIME MOCKUP V1.0
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7"
          onClick={() => setIsFullView(!isFullView)}
        >
          {isFullView ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Main Preview Stage */}
      <div
        className={cn(
          "relative rounded-xl overflow-hidden border border-border bg-gradient-to-b from-zinc-800 to-zinc-900 flex items-center justify-center transition-all duration-300",
          isFullView ? "aspect-[3/4] flex-1" : "aspect-square"
        )}
        style={{ backgroundColor: tshirtColor.hex }}
      >
        {/* 1. Base Texture (The Shirt) */}
        <img
          src={tshirtColor.image}
          alt={`${tshirtColor.name} t-shirt mockup`}
          className="absolute inset-0 w-full h-full object-contain"
          onError={(e) => {
            // Fallback to solid color if image fails to load
            e.currentTarget.style.display = 'none';
          }}
        />

        {/* 2. The Design Layer */}
        {designImage && (
          <div
            className="absolute z-10 pointer-events-none"
            style={{
              top: "28%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "35%",
            }}
          >
            <img
              src={designImage}
              alt="Design preview"
              className="w-full h-auto"
              style={{ mixBlendMode: "multiply", filter: "contrast(1.05)" }}
            />
          </div>
        )}

        {/* 3. Shadow/Fold Overlay for realism */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 50% 30%, transparent 40%, rgba(0,0,0,0.15) 100%)",
          }}
        />

        {/* Placeholder when no design */}
        {!designImage && (
          <div className="text-center text-muted-foreground p-4 z-10">
            <Shirt className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">Your design will appear here</p>
          </div>
        )}
      </div>

      {/* Selector: Horizontal Strip */}
      <div className="mt-4 space-y-2">
        <span className="text-xs text-muted-foreground font-medium">Fabric Color</span>
        <div className="flex gap-2 p-1.5 bg-muted/30 rounded-lg">
          {tshirtColors.map((color) => (
            <button
              key={color.id}
              onClick={() => setTshirtColor(color)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md transition-all duration-200",
                tshirtColor.id === color.id
                  ? "bg-background shadow-sm border border-border"
                  : "hover:bg-background/50"
              )}
            >
              <div
                className={cn(
                  "w-4 h-4 rounded-full border-2 transition-transform",
                  tshirtColor.id === color.id ? "scale-110 border-primary" : "border-border"
                )}
                style={{ backgroundColor: color.hex }}
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  tshirtColor.id === color.id ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {color.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Info Note */}
      <div className="mt-3 p-2.5 bg-muted/30 rounded-lg text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">Note:</strong> This is a preview. Final print may vary slightly.
        </p>
      </div>
    </div>
  );
};

export default MockupPreview;
