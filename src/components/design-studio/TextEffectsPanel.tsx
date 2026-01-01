import { useState } from "react";
import { Sparkles, Layers, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { DesignCanvasRef } from "./DesignCanvas";
import { toast } from "sonner";
import { IText, Rect, FabricObject, Group } from "fabric";

interface TextEffectsPanelProps {
  canvasRef: DesignCanvasRef | null;
  activeColor: string;
}

// Curved text presets
const curvePresets = [
  { id: "arch-up", name: "Arch Up", radius: 200 },
  { id: "arch-down", name: "Arch Down", radius: -200 },
  { id: "wave", name: "Wave", radius: 150 },
  { id: "circle", name: "Circle", radius: 100 },
];

// 3D/Shadow effect presets
const shadowPresets = [
  { id: "retro-3d", name: "Retro 3D", layers: 4, offsetX: 3, offsetY: 3, shadowColor: "#000000" },
  { id: "neon-glow", name: "Neon Glow", layers: 3, offsetX: 0, offsetY: 0, shadowColor: "#ec4899", blur: true },
  { id: "long-shadow", name: "Long Shadow", layers: 8, offsetX: 2, offsetY: 2, shadowColor: "#1a1a1a" },
  { id: "outline", name: "Bold Outline", layers: 1, offsetX: 0, offsetY: 0, shadowColor: "#ffffff", stroke: true },
];

const TextEffectsPanel = ({ canvasRef, activeColor }: TextEffectsPanelProps) => {
  const [shadowOffset, setShadowOffset] = useState(4);
  const [shadowLayers, setShadowLayers] = useState(4);

  // Create 3D shadow effect by stacking text copies
  const apply3DEffect = (preset: typeof shadowPresets[0]) => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;

    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.type !== "i-text") {
      toast.error("Select a text object first");
      return;
    }

    const textObj = activeObj as IText;
    const originalLeft = textObj.left ?? 0;
    const originalTop = textObj.top ?? 0;
    const originalFill = textObj.fill;

    // Remove the original from canvas temporarily
    canvas.remove(textObj);

    // Create shadow layers
    const layers: FabricObject[] = [];
    const layerCount = preset.stroke ? 1 : preset.layers;

    for (let i = layerCount; i >= 0; i--) {
      const clone = new IText(textObj.text || "", {
        left: originalLeft + (preset.offsetX * i),
        top: originalTop + (preset.offsetY * i),
        fill: i === 0 ? originalFill : preset.shadowColor,
        fontFamily: (textObj as any).fontFamily || "Arial",
        fontSize: (textObj as any).fontSize || 48,
        fontWeight: (textObj as any).fontWeight || "normal",
        stroke: preset.stroke && i > 0 ? preset.shadowColor : undefined,
        strokeWidth: preset.stroke && i > 0 ? 3 : 0,
      });

      // For neon glow, add decreasing opacity
      if (preset.blur && i > 0) {
        clone.set("opacity", 0.3 + (0.7 * (1 - i / layerCount)));
      }

      layers.push(clone);
    }

    // Add all layers
    layers.forEach(layer => canvas.add(layer));
    
    // Group them together
    const group = new Group(layers, {
      left: originalLeft,
      top: originalTop,
    });

    // Remove individual layers and add group
    layers.forEach(layer => canvas.remove(layer));
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();

    toast.success(`${preset.name} effect applied!`);
  };

  // Apply custom 3D effect with slider values
  const applyCustom3D = () => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;

    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.type !== "i-text") {
      toast.error("Select a text object first");
      return;
    }

    apply3DEffect({
      id: "custom",
      name: "Custom 3D",
      layers: shadowLayers,
      offsetX: shadowOffset / 2,
      offsetY: shadowOffset / 2,
      shadowColor: "#000000",
    });
  };

  // Bring selected object forward
  const bringForward = () => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (activeObj) {
      canvas.bringObjectForward(activeObj);
      canvas.requestRenderAll();
    }
  };

  // Send selected object backward
  const sendBackward = () => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (activeObj) {
      canvas.sendObjectBackwards(activeObj);
      canvas.requestRenderAll();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Sparkles className="w-4 h-4" />
        <span>Text Effects</span>
      </div>

      {/* 3D Shadow Presets */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">3D & Shadow Effects</Label>
        <div className="grid grid-cols-2 gap-1">
          {shadowPresets.map((preset) => (
            <button
              key={preset.id}
              className="px-2 py-2 text-xs bg-muted hover:bg-accent rounded border border-border hover:border-primary transition-colors text-left"
              onClick={() => apply3DEffect(preset)}
            >
              <span className="font-medium">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom 3D Controls */}
      <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
        <Label className="text-xs text-muted-foreground">Custom 3D Effect</Label>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Offset</span>
            <span className="text-xs text-muted-foreground">{shadowOffset}px</span>
          </div>
          <Slider
            value={[shadowOffset]}
            onValueChange={(v) => setShadowOffset(v[0])}
            min={1}
            max={12}
            step={1}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Layers</span>
            <span className="text-xs text-muted-foreground">{shadowLayers}</span>
          </div>
          <Slider
            value={[shadowLayers]}
            onValueChange={(v) => setShadowLayers(v[0])}
            min={2}
            max={10}
            step={1}
            className="w-full"
          />
        </div>

        <Button size="sm" className="w-full" onClick={applyCustom3D}>
          Apply Custom 3D
        </Button>
      </div>

      {/* Layer Order Controls */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <Layers className="w-3 h-3" />
          Layer Order
        </Label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={bringForward}>
            <ArrowUp className="w-3 h-3 mr-1" />
            Forward
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={sendBackward}>
            <ArrowDown className="w-3 h-3 mr-1" />
            Back
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TextEffectsPanel;
