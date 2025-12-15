import { useState } from "react";
import { Download, ShoppingBag, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DesignCanvasRef } from "./DesignCanvas";
import { toast } from "sonner";

interface ExportPanelProps {
  canvasRef: DesignCanvasRef | null;
  onOrder: (size: string) => void;
}

const sizes = [
  { id: "s", label: "S", description: "Small" },
  { id: "m", label: "M", description: "Medium" },
  { id: "l", label: "L", description: "Large" },
  { id: "xl", label: "XL", description: "Extra Large" },
  { id: "xxl", label: "XXL", description: "2X Large" },
];

const ExportPanel = ({ canvasRef, onOrder }: ExportPanelProps) => {
  const [selectedSize, setSelectedSize] = useState("m");
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = () => {
    if (!canvasRef) return;
    
    setIsExporting(true);
    
    try {
      const dataUrl = canvasRef.exportImage();
      if (dataUrl) {
        const link = document.createElement("a");
        link.download = "alternate-design.png";
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Design downloaded!");
      }
    } catch (error) {
      toast.error("Failed to export design");
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (!canvasRef) return;
    
    try {
      const dataUrl = canvasRef.exportImage();
      if (dataUrl && navigator.share) {
        const blob = await fetch(dataUrl).then((r) => r.blob());
        const file = new File([blob], "alternate-design.png", { type: "image/png" });
        await navigator.share({
          title: "My Alternate Design",
          text: "Check out my custom design!",
          files: [file],
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard!");
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast.error("Failed to share");
      }
    }
  };

  const handleOrder = () => {
    onOrder(selectedSize);
  };

  // Pricing
  const basePrice = 45000; // UGX
  const customFee = 15000; // UGX
  const totalPrice = basePrice + customFee;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <ShoppingBag className="w-4 h-4" />
        <span>Order</span>
      </div>

      {/* Size Selection */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Select Size</Label>
        <RadioGroup
          value={selectedSize}
          onValueChange={setSelectedSize}
          className="grid grid-cols-5 gap-1"
        >
          {sizes.map((size) => (
            <div key={size.id} className="relative">
              <RadioGroupItem
                value={size.id}
                id={`size-${size.id}`}
                className="peer sr-only"
              />
              <label
                htmlFor={`size-${size.id}`}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedSize === size.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <span className="text-sm font-bold">{size.label}</span>
              </label>
              {selectedSize === size.id && (
                <Check className="absolute -top-1 -right-1 w-4 h-4 text-primary bg-background rounded-full" />
              )}
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Pricing */}
      <div className="p-3 bg-muted rounded-lg space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Base Tee</span>
          <span>UGX {basePrice.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Custom Print</span>
          <span>UGX {customFee.toLocaleString()}</span>
        </div>
        <div className="h-px bg-border" />
        <div className="flex justify-between font-medium">
          <span>Total</span>
          <span className="text-primary">UGX {totalPrice.toLocaleString()}</span>
        </div>
      </div>

      {/* Order Button */}
      <Button
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        size="lg"
        onClick={handleOrder}
      >
        <ShoppingBag className="w-4 h-4 mr-2" />
        Order This Design
      </Button>

      {/* Export Options */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Export</Label>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDownload}
            disabled={isExporting}
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="text-xs text-muted-foreground">
        <p>
          ✓ High-quality DTG print
          <br />
          ✓ Premium cotton tee
          <br />✓ Delivery in 3-5 days
        </p>
      </div>
    </div>
  );
};

export default ExportPanel;
