import { useState } from "react";
import { Pipette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

const presetColors = [
  "#ffffff", // White
  "#000000", // Black
  "#84cc16", // Lime (brand primary)
  "#facc15", // Yellow (cyber yellow)
  "#ec4899", // Pink (hot pink)
  "#ef4444", // Red
  "#f97316", // Orange
  "#22c55e", // Green
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#6b7280", // Gray
];

const ColorPicker = ({ color, onChange }: ColorPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hexInput, setHexInput] = useState(color);

  const handleHexChange = (value: string) => {
    setHexInput(value);
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      onChange(value);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="w-10 h-10 p-1 border-2"
          style={{ borderColor: color }}
        >
          <div
            className="w-full h-full rounded"
            style={{ backgroundColor: color }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" side="right">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Pipette className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Color</span>
          </div>

          {/* Preset Colors Grid */}
          <div className="grid grid-cols-6 gap-2">
            {presetColors.map((presetColor) => (
              <button
                key={presetColor}
                className={`w-8 h-8 rounded border-2 transition-transform hover:scale-110 ${
                  color === presetColor ? "border-primary" : "border-transparent"
                }`}
                style={{ backgroundColor: presetColor }}
                onClick={() => {
                  onChange(presetColor);
                  setHexInput(presetColor);
                }}
              />
            ))}
          </div>

          {/* Hex Input */}
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded border border-border"
              style={{ backgroundColor: color }}
            />
            <Input
              value={hexInput}
              onChange={(e) => handleHexChange(e.target.value)}
              placeholder="#000000"
              className="flex-1 h-8 text-sm font-mono"
            />
          </div>

          {/* Native Color Picker */}
          <input
            type="color"
            value={color}
            onChange={(e) => {
              onChange(e.target.value);
              setHexInput(e.target.value);
            }}
            className="w-full h-8 cursor-pointer rounded"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ColorPicker;
