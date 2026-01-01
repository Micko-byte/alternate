import { useState, useEffect } from "react";
import { Palette, Plus, Pipette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DesignCanvasRef } from "./DesignCanvas";
import { toast } from "sonner";
import { FabricObject } from "fabric";

interface ColorSwatchPanelProps {
  canvasRef: DesignCanvasRef | null;
  activeColor: string;
  onColorChange: (color: string) => void;
}

// Predefined color palettes (Kittl-style)
const palettes = {
  vintage: ["#2D3436", "#D63031", "#FDCB6E", "#00B894", "#E17055"],
  neon: ["#FF0099", "#00F5FF", "#FFFF00", "#FF6600", "#9D00FF"],
  earth: ["#8B4513", "#228B22", "#DEB887", "#556B2F", "#D2691E"],
  pastel: ["#FFB5E8", "#B5DEFF", "#85E3FF", "#BFFCC6", "#FFC9DE"],
  monochrome: ["#000000", "#333333", "#666666", "#999999", "#FFFFFF"],
  streetwear: ["#84CC16", "#000000", "#FFFFFF", "#EF4444", "#F97316"],
};

const ColorSwatchPanel = ({ canvasRef, activeColor, onColorChange }: ColorSwatchPanelProps) => {
  const [projectColors, setProjectColors] = useState<string[]>([]);
  const [customColor, setCustomColor] = useState("#84cc16");
  const [selectedPalette, setSelectedPalette] = useState<keyof typeof palettes>("streetwear");

  // Extract unique colors from canvas objects
  const extractProjectColors = () => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;

    const colors = new Set<string>();
    
    const extractFromObject = (obj: FabricObject) => {
      const fill = obj.fill;
      const stroke = obj.stroke;
      
      if (typeof fill === "string" && fill !== "transparent") {
        colors.add(fill.toLowerCase());
      }
      if (typeof stroke === "string" && stroke !== "transparent") {
        colors.add(stroke.toLowerCase());
      }
      
      // Check for groups
      if ((obj as any).getObjects) {
        (obj as any).getObjects().forEach((child: FabricObject) => {
          extractFromObject(child);
        });
      }
    };

    canvas.getObjects().forEach(obj => {
      if (obj.selectable !== false) {
        extractFromObject(obj);
      }
    });

    setProjectColors(Array.from(colors).slice(0, 10));
  };

  // Sync on canvas changes
  useEffect(() => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;

    const handleUpdate = () => extractProjectColors();
    
    canvas.on("object:added", handleUpdate);
    canvas.on("object:modified", handleUpdate);
    canvas.on("object:removed", handleUpdate);

    extractProjectColors();

    return () => {
      canvas.off("object:added", handleUpdate);
      canvas.off("object:modified", handleUpdate);
      canvas.off("object:removed", handleUpdate);
    };
  }, [canvasRef]);

  // Recursive SVG recoloring - replace one color with another throughout the design
  const replaceColor = (oldColor: string, newColor: string) => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;

    const replaceInObject = (obj: FabricObject) => {
      const objFill = typeof obj.fill === "string" ? obj.fill.toLowerCase() : null;
      const objStroke = typeof obj.stroke === "string" ? obj.stroke.toLowerCase() : null;
      const targetColor = oldColor.toLowerCase();

      if (objFill === targetColor) {
        obj.set("fill", newColor);
      }
      if (objStroke === targetColor) {
        obj.set("stroke", newColor);
      }

      // Recursively handle groups
      if ((obj as any).getObjects) {
        (obj as any).getObjects().forEach((child: FabricObject) => {
          replaceInObject(child);
        });
      }
    };

    canvas.getObjects().forEach(obj => {
      replaceInObject(obj);
    });

    canvas.requestRenderAll();
    extractProjectColors();
    toast.success("Colors replaced!");
  };

  // Apply color to selected object
  const applyColorToSelected = (color: string) => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;

    const activeObj = canvas.getActiveObject();
    if (activeObj) {
      activeObj.set("fill", color);
      canvas.requestRenderAll();
    }
    
    onColorChange(color);
  };

  // Add custom color
  const addCustomColor = () => {
    if (!projectColors.includes(customColor.toLowerCase())) {
      setProjectColors(prev => [...prev, customColor].slice(0, 10));
    }
    applyColorToSelected(customColor);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Palette className="w-4 h-4" />
        <span>Color Swatches</span>
      </div>

      {/* Active Color */}
      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
        <div 
          className="w-8 h-8 rounded border border-border" 
          style={{ backgroundColor: activeColor }}
        />
        <div className="flex-1">
          <p className="text-xs font-medium">Active Color</p>
          <p className="text-xs text-muted-foreground uppercase">{activeColor}</p>
        </div>
      </div>

      {/* Project Colors (Auto-extracted) */}
      {projectColors.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Pipette className="w-3 h-3" />
              Project Colors
            </Label>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-6"
              onClick={extractProjectColors}
            >
              Refresh
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {projectColors.map((color, i) => (
              <button
                key={`${color}-${i}`}
                className={`w-7 h-7 rounded border-2 transition-all hover:scale-110 ${
                  activeColor.toLowerCase() === color ? "border-primary" : "border-border"
                }`}
                style={{ backgroundColor: color }}
                onClick={() => applyColorToSelected(color)}
                title={`Click to use, or drag to replace`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Color Palettes */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Palettes</Label>
        <div className="grid grid-cols-3 gap-1">
          {(Object.keys(palettes) as Array<keyof typeof palettes>).map((name) => (
            <button
              key={name}
              className={`px-2 py-1 text-xs rounded border capitalize transition-colors ${
                selectedPalette === name
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-muted-foreground"
              }`}
              onClick={() => setSelectedPalette(name)}
            >
              {name}
            </button>
          ))}
        </div>
        
        {/* Selected Palette Colors */}
        <div className="flex gap-1 pt-1">
          {palettes[selectedPalette].map((color, i) => (
            <button
              key={`${color}-${i}`}
              className={`flex-1 h-8 rounded border-2 transition-all hover:scale-105 ${
                activeColor.toLowerCase() === color.toLowerCase() ? "border-primary" : "border-border"
              }`}
              style={{ backgroundColor: color }}
              onClick={() => applyColorToSelected(color)}
            />
          ))}
        </div>
      </div>

      {/* Custom Color */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Custom Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            className="w-12 h-8 p-0 border-0"
          />
          <Input
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            className="flex-1 text-xs uppercase"
            maxLength={7}
          />
          <Button size="sm" variant="outline" onClick={addCustomColor}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Swap Colors Section */}
      {projectColors.length >= 2 && (
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <Label className="text-xs font-medium">Quick Color Swap</Label>
          <p className="text-xs text-muted-foreground">
            Click a project color above, then click "Replace All" to swap it everywhere in your design.
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={() => {
              if (projectColors.length >= 2 && activeColor) {
                const otherColor = projectColors.find(c => c !== activeColor.toLowerCase());
                if (otherColor) {
                  replaceColor(otherColor, activeColor);
                }
              }
            }}
          >
            Replace All Similar Colors
          </Button>
        </div>
      )}
    </div>
  );
};

export default ColorSwatchPanel;
