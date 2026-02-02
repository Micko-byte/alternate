import { 
  Type, Square, Circle, Image, Trash2, Copy, 
  ArrowUp, ArrowDown, RotateCw, Palette, AlignCenter,
  Wand2, Download, Save, Undo2, Redo2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { DesignObject } from './DesignCanvas2D';

interface ToolsPanelProps {
  activeColor: string;
  onColorChange: (color: string) => void;
  onAddText: () => void;
  onAddShape: (shape: 'rect' | 'circle') => void;
  onAddImage: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onAlignCenter: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onSave: () => void;
  selectedObject: DesignObject | null;
  onUpdateObject: (updates: Partial<DesignObject>) => void;
  canUndo: boolean;
  canRedo: boolean;
}

const colorPalette = [
  '#ffffff', '#000000', '#84cc16', '#ef4444', '#3b82f6',
  '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
];

const ToolsPanel = ({
  activeColor,
  onColorChange,
  onAddText,
  onAddShape,
  onAddImage,
  onDelete,
  onDuplicate,
  onBringToFront,
  onSendToBack,
  onAlignCenter,
  onUndo,
  onRedo,
  onExport,
  onSave,
  selectedObject,
  onUpdateObject,
  canUndo,
  canRedo
}: ToolsPanelProps) => {
  return (
    <div className="w-72 bg-card border-l border-border flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Design Tools</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Add Elements */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Add Elements</h4>
          <div className="grid grid-cols-4 gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-12 w-full"
              onClick={onAddText}
              title="Add Text"
            >
              <Type className="h-5 w-5" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-12 w-full"
              onClick={() => onAddShape('rect')}
              title="Add Rectangle"
            >
              <Square className="h-5 w-5" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-12 w-full"
              onClick={() => onAddShape('circle')}
              title="Add Circle"
            >
              <Circle className="h-5 w-5" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-12 w-full"
              onClick={onAddImage}
              title="Add Image"
            >
              <Image className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Color Palette */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Colors</h4>
          <div className="flex flex-wrap gap-2">
            {colorPalette.map((color) => (
              <button
                key={color}
                onClick={() => onColorChange(color)}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110",
                  activeColor === color ? "border-primary scale-110" : "border-border"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <Input
              type="color"
              value={activeColor}
              onChange={(e) => onColorChange(e.target.value)}
              className="w-full h-8 p-0 border-0 cursor-pointer"
            />
          </div>
        </div>

        <Separator />

        {/* Object Controls */}
        {selectedObject && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Selected Object</h4>
            
            {/* Text-specific controls */}
            {selectedObject.type === 'text' && (
              <div className="space-y-2">
                <Input
                  value={selectedObject.text || ''}
                  onChange={(e) => onUpdateObject({ text: e.target.value })}
                  placeholder="Enter text..."
                  className="text-sm"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16">Size</span>
                  <Slider
                    value={[selectedObject.fontSize || 48]}
                    onValueChange={([value]) => onUpdateObject({ fontSize: value })}
                    min={12}
                    max={120}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-8">
                    {selectedObject.fontSize || 48}
                  </span>
                </div>
              </div>
            )}

            {/* Shape-specific controls */}
            {selectedObject.type === 'shape' && (
              <div className="space-y-2">
                {selectedObject.shape === 'rect' && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16">Width</span>
                      <Slider
                        value={[selectedObject.width || 100]}
                        onValueChange={([value]) => onUpdateObject({ width: value })}
                        min={20}
                        max={400}
                        step={1}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16">Height</span>
                      <Slider
                        value={[selectedObject.height || 100]}
                        onValueChange={([value]) => onUpdateObject({ height: value })}
                        min={20}
                        max={400}
                        step={1}
                        className="flex-1"
                      />
                    </div>
                  </>
                )}
                {selectedObject.shape === 'circle' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16">Radius</span>
                    <Slider
                      value={[selectedObject.radius || 50]}
                      onValueChange={([value]) => onUpdateObject({ radius: value })}
                      min={10}
                      max={200}
                      step={1}
                      className="flex-1"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Image-specific controls */}
            {selectedObject.type === 'image' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16">Width</span>
                  <Slider
                    value={[selectedObject.width || 100]}
                    onValueChange={([value]) => onUpdateObject({ width: value, height: value })}
                    min={50}
                    max={400}
                    step={1}
                    className="flex-1"
                  />
                </div>
              </div>
            )}

            {/* Common controls */}
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={onDuplicate} title="Duplicate">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={onBringToFront} title="Bring to Front">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={onSendToBack} title="Send to Back">
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={onAlignCenter} title="Center">
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button variant="destructive" size="icon" onClick={onDelete} title="Delete">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <Separator />

        {/* History */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">History</h4>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onUndo}
              disabled={!canUndo}
              className="flex-1"
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Undo
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRedo}
              disabled={!canRedo}
              className="flex-1"
            >
              <Redo2 className="h-4 w-4 mr-2" />
              Redo
            </Button>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <Button onClick={onSave} className="w-full" variant="default">
          <Save className="h-4 w-4 mr-2" />
          Save Design
        </Button>
        <Button onClick={onExport} className="w-full" variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export PNG
        </Button>
      </div>
    </div>
  );
};

export default ToolsPanel;
