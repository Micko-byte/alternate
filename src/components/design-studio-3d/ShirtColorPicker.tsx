import { cn } from '@/lib/utils';
import { Shirt } from 'lucide-react';

interface ShirtColor {
  id: string;
  name: string;
  hex: string;
}

interface ShirtColorPickerProps {
  colors: ShirtColor[];
  selectedColor: string;
  onColorChange: (color: ShirtColor) => void;
}

const ShirtColorPicker = ({ colors, selectedColor, onColorChange }: ShirtColorPickerProps) => {
  const selected = colors.find(c => c.hex === selectedColor);

  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Shirt className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">T-Shirt Color</span>
      </div>
      
      <div className="flex gap-2">
        {colors.map((color) => (
          <button
            key={color.id}
            onClick={() => onColorChange(color)}
            className={cn(
              "w-10 h-10 rounded-full border-2 transition-all hover:scale-110 relative",
              selectedColor === color.hex 
                ? "border-primary ring-2 ring-primary/30 scale-110" 
                : "border-border hover:border-muted-foreground"
            )}
            style={{ backgroundColor: color.hex }}
            title={color.name}
          >
            {color.hex === '#FFFFFF' && (
              <div className="absolute inset-0 rounded-full border border-zinc-300" />
            )}
          </button>
        ))}
      </div>

      {selected && (
        <p className="text-xs text-muted-foreground">
          Selected: <span className="text-foreground font-medium">{selected.name}</span>
        </p>
      )}
    </div>
  );
};

export default ShirtColorPicker;
