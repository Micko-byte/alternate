import { useState } from "react";
import { Type, AlignLeft, AlignCenter, AlignRight, Bold, Italic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { DesignCanvasRef } from "./DesignCanvas";

interface TextPanelProps {
  canvasRef: DesignCanvasRef | null;
  activeColor: string;
}

const fonts = [
  { name: "Bebas Neue", label: "Bebas Neue" },
  { name: "Inter", label: "Inter" },
  { name: "Arial Black", label: "Arial Black" },
  { name: "Impact", label: "Impact" },
  { name: "Georgia", label: "Georgia" },
  { name: "Courier New", label: "Courier" },
];

const TextPanel = ({ canvasRef, activeColor }: TextPanelProps) => {
  const [textInput, setTextInput] = useState("YOUR TEXT");
  const [selectedFont, setSelectedFont] = useState("Bebas Neue");
  const [fontSize, setFontSize] = useState(48);

  const handleAddText = () => {
    if (canvasRef && textInput.trim()) {
      canvasRef.addText(textInput, {
        fontFamily: selectedFont,
        fontSize: fontSize,
        fill: activeColor,
      });
    }
  };

  const updateSelectedObject = (property: string, value: unknown) => {
    if (!canvasRef?.canvas) return;
    const activeObject = canvasRef.canvas.getActiveObject();
    if (activeObject && activeObject.type === "i-text") {
      activeObject.set(property as keyof typeof activeObject, value);
      canvasRef.canvas.renderAll();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Type className="w-4 h-4" />
        <span>Text</span>
      </div>

      {/* Text Input */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Add Text</Label>
        <div className="flex gap-2">
          <Input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Enter text..."
            className="flex-1"
          />
          <Button size="sm" onClick={handleAddText}>
            Add
          </Button>
        </div>
      </div>

      {/* Font Selection */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Font Family</Label>
        <div className="grid grid-cols-2 gap-1">
          {fonts.map((font) => (
            <button
              key={font.name}
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                selectedFont === font.name
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-muted-foreground"
              }`}
              style={{ fontFamily: font.name }}
              onClick={() => {
                setSelectedFont(font.name);
                updateSelectedObject("fontFamily", font.name);
              }}
            >
              {font.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Font Size</Label>
          <span className="text-xs text-muted-foreground">{fontSize}px</span>
        </div>
        <Slider
          value={[fontSize]}
          onValueChange={(value) => {
            setFontSize(value[0]);
            updateSelectedObject("fontSize", value[0]);
          }}
          min={12}
          max={120}
          step={1}
          className="w-full"
        />
      </div>

      {/* Text Alignment */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Alignment</Label>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="w-8 h-8"
            onClick={() => updateSelectedObject("textAlign", "left")}
          >
            <AlignLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="w-8 h-8"
            onClick={() => updateSelectedObject("textAlign", "center")}
          >
            <AlignCenter className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="w-8 h-8"
            onClick={() => updateSelectedObject("textAlign", "right")}
          >
            <AlignRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Text Style */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Style</Label>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="w-8 h-8"
            onClick={() => {
              const canvas = canvasRef?.canvas;
              if (!canvas) return;
              const obj = canvas.getActiveObject();
              if (obj && obj.type === "i-text") {
                const current = (obj as { fontWeight?: string | number }).fontWeight;
                updateSelectedObject("fontWeight", current === "bold" ? "normal" : "bold");
              }
            }}
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="w-8 h-8"
            onClick={() => {
              const canvas = canvasRef?.canvas;
              if (!canvas) return;
              const obj = canvas.getActiveObject();
              if (obj && obj.type === "i-text") {
                const current = (obj as { fontStyle?: string }).fontStyle;
                updateSelectedObject("fontStyle", current === "italic" ? "normal" : "italic");
              }
            }}
          >
            <Italic className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Quick Add Text Presets */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Quick Add</Label>
        <div className="flex flex-wrap gap-1">
          {["FRESH", "LIMITED", "EXCLUSIVE", "STREET", "URBAN"].map((text) => (
            <button
              key={text}
              className="px-2 py-1 text-xs bg-muted hover:bg-accent rounded transition-colors"
              onClick={() => {
                canvasRef?.addText(text, {
                  fontFamily: selectedFont,
                  fontSize: fontSize,
                  fill: activeColor,
                });
              }}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TextPanel;
