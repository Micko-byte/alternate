import { useState, useEffect } from "react";
import { Shirt, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DesignCanvasRef } from "./DesignCanvas";

interface MockupPreviewProps {
  canvasRef: DesignCanvasRef | null;
}

const tshirtColors = [
  { id: "black", name: "Black", hex: "#1a1a1a" },
  { id: "white", name: "White", hex: "#f5f5f5" },
  { id: "grey", name: "Grey", hex: "#6b7280" },
  { id: "navy", name: "Navy", hex: "#1e3a5f" },
];

const MockupPreview = ({ canvasRef }: MockupPreviewProps) => {
  const [tshirtColor, setTshirtColor] = useState(tshirtColors[0]);
  const [designImage, setDesignImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Update design preview when canvas changes
  useEffect(() => {
    if (!canvasRef?.canvas) return;

    const updatePreview = () => {
      const dataUrl = canvasRef.exportImage();
      if (dataUrl) {
        setDesignImage(dataUrl);
      }
    };

    // Initial render
    updatePreview();

    // Listen for canvas changes
    const canvas = canvasRef.canvas;
    canvas.on("object:added", updatePreview);
    canvas.on("object:modified", updatePreview);
    canvas.on("object:removed", updatePreview);

    return () => {
      canvas.off("object:added", updatePreview);
      canvas.off("object:modified", updatePreview);
      canvas.off("object:removed", updatePreview);
    };
  }, [canvasRef]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 2));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Shirt className="w-4 h-4" />
        <span>Preview</span>
      </div>

      {/* T-Shirt Mockup */}
      <div
        className="relative aspect-square rounded-lg border border-border overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: tshirtColor.hex }}
      >
        {/* T-Shirt SVG Shape */}
        <svg
          viewBox="0 0 200 220"
          className="absolute inset-0 w-full h-full opacity-20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        >
          {/* Simple t-shirt outline */}
          <path
            d="M60 30 L30 50 L30 80 L50 80 L50 200 L150 200 L150 80 L170 80 L170 50 L140 30 L120 40 L80 40 L60 30"
            className="text-foreground"
          />
        </svg>

        {/* Design Overlay */}
        {designImage && (
          <div
            className="relative z-10 transition-transform duration-200"
            style={{
              transform: `scale(${zoom * 0.4}) rotate(${rotation}deg)`,
            }}
          >
            <img
              src={designImage}
              alt="Design preview"
              className="w-full h-auto max-w-[180px] rounded"
              style={{ mixBlendMode: "multiply" }}
            />
          </div>
        )}

        {!designImage && (
          <div className="text-center text-muted-foreground p-4 z-10">
            <Shirt className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">Your design will appear here</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="icon" className="w-8 h-8" onClick={handleZoomOut}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="outline" size="icon" className="w-8 h-8" onClick={handleZoomIn}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" className="w-8 h-8" onClick={handleRotate}>
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* T-Shirt Color Selection */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">T-Shirt Color</Label>
        <div className="flex gap-2">
          {tshirtColors.map((color) => (
            <button
              key={color.id}
              className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                tshirtColor.id === color.id
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border"
              }`}
              style={{ backgroundColor: color.hex }}
              onClick={() => setTshirtColor(color)}
              title={color.name}
            />
          ))}
        </div>
      </div>

      {/* Mockup Info */}
      <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
        <p>
          <strong>Note:</strong> This is a preview. Final print may vary slightly.
        </p>
      </div>
    </div>
  );
};

export default MockupPreview;
