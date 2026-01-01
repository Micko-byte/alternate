import { useState } from "react";
import { Brush, Eraser, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { DesignCanvasRef } from "./DesignCanvas";
import { toast } from "sonner";
import { FabricImage } from "fabric";

interface TexturesPanelProps {
  canvasRef: DesignCanvasRef | null;
}

// Grunge/distress texture presets (using placeholder URLs - these would be real texture PNGs)
const texturePresets = [
  { 
    id: "grunge-1", 
    name: "Light Grunge", 
    // Using a data URL for a simple noise pattern
    url: "data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E",
  },
  { 
    id: "grunge-2", 
    name: "Heavy Distress", 
    url: "data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='6' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.7'/%3E%3C/svg%3E",
  },
  { 
    id: "scratches", 
    name: "Scratches", 
    url: "data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg stroke='%23000' stroke-width='0.3' opacity='0.5'%3E%3Cline x1='10' y1='0' x2='30' y2='100'/%3E%3Cline x1='45' y1='0' x2='55' y2='100'/%3E%3Cline x1='70' y1='0' x2='90' y2='100'/%3E%3Cline x1='25' y1='0' x2='15' y2='100'/%3E%3Cline x1='60' y1='0' x2='75' y2='100'/%3E%3C/g%3E%3C/svg%3E",
  },
  { 
    id: "dots", 
    name: "Halftone", 
    url: "data:image/svg+xml,%3Csvg viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='10' cy='10' r='3' fill='%23000' opacity='0.3'/%3E%3C/svg%3E",
  },
];

const TexturesPanel = ({ canvasRef }: TexturesPanelProps) => {
  const [textureOpacity, setTextureOpacity] = useState(0.5);
  const [activeTexture, setActiveTexture] = useState<string | null>(null);

  // Apply distress/grunge texture using destination-out composite
  const applyTexture = async (texture: typeof texturePresets[0]) => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;

    try {
      // Remove existing texture layer if any
      removeTexture();

      const img = await FabricImage.fromURL(texture.url, { crossOrigin: "anonymous" });
      
      // Scale to cover canvas
      const scaleX = canvas.width! / (img.width || 1);
      const scaleY = canvas.height! / (img.height || 1);
      const scale = Math.max(scaleX, scaleY);
      
      img.set({
        scaleX: scale,
        scaleY: scale,
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
        opacity: textureOpacity,
        // The magic - this creates the distressed/worn look
        globalCompositeOperation: "destination-out",
        // Custom property to identify texture layer
        data: { isTexture: true, textureId: texture.id },
      });

      canvas.add(img);
      canvas.requestRenderAll();
      
      setActiveTexture(texture.id);
      toast.success(`${texture.name} texture applied!`);
    } catch (error) {
      console.error("Failed to apply texture:", error);
      toast.error("Failed to apply texture");
    }
  };

  // Remove texture layer
  const removeTexture = () => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;

    const objects = canvas.getObjects();
    objects.forEach(obj => {
      const objData = (obj as any).data;
      if (objData?.isTexture) {
        canvas.remove(obj);
      }
    });
    
    canvas.requestRenderAll();
    setActiveTexture(null);
  };

  // Update texture opacity
  const updateTextureOpacity = (opacity: number) => {
    setTextureOpacity(opacity);
    
    const canvas = canvasRef?.canvas;
    if (!canvas) return;

    const objects = canvas.getObjects();
    objects.forEach(obj => {
      const objData = (obj as any).data;
      if (objData?.isTexture) {
        obj.set("opacity", opacity);
      }
    });
    
    canvas.requestRenderAll();
  };

  // Handle custom texture upload
  const handleTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        await applyTexture({
          id: "custom",
          name: "Custom",
          url: dataUrl,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Brush className="w-4 h-4" />
        <span>Textures & Distress</span>
      </div>

      <Label className="text-xs text-muted-foreground">
        Add vintage/distressed effects to your design
      </Label>

      {/* Texture Presets */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Preset Textures</Label>
        <div className="grid grid-cols-2 gap-1">
          {texturePresets.map((texture) => (
            <button
              key={texture.id}
              className={`px-2 py-2 text-xs rounded border transition-colors text-left ${
                activeTexture === texture.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted hover:bg-accent hover:border-muted-foreground"
              }`}
              onClick={() => applyTexture(texture)}
            >
              {texture.name}
            </button>
          ))}
        </div>
      </div>

      {/* Opacity Control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Intensity</Label>
          <span className="text-xs text-muted-foreground">{Math.round(textureOpacity * 100)}%</span>
        </div>
        <Slider
          value={[textureOpacity]}
          onValueChange={(v) => updateTextureOpacity(v[0])}
          min={0.1}
          max={1}
          step={0.05}
          className="w-full"
        />
      </div>

      {/* Custom Upload */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Custom Texture</Label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <label className="cursor-pointer">
              <Upload className="w-3 h-3 mr-1" />
              Upload PNG
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleTextureUpload}
              />
            </label>
          </Button>
        </div>
      </div>

      {/* Remove Texture */}
      {activeTexture && (
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={removeTexture}
        >
          <Eraser className="w-3 h-3 mr-1" />
          Remove Texture
        </Button>
      )}

      {/* Pro Tip */}
      <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Pro Tip:</span> Use black/white PNG textures for best results. The texture "punches through" your design to reveal the shirt color.
        </p>
      </div>
    </div>
  );
};

export default TexturesPanel;
