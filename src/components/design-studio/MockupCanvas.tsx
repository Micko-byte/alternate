import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Canvas, FabricImage, FabricObject } from 'fabric';
import * as fabric from 'fabric';
import { Upload, Download, RotateCw, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface MockupCanvasRef {
  canvas: Canvas | null;
  addImage: (url: string) => Promise<void>;
  exportDesign: () => string | null;
  exportDesignOnly: () => string | null;
  clear: () => void;
}

interface TShirtColor {
  id: string;
  name: string;
  hex: string;
  image: string;
}

const tshirtColors: TShirtColor[] = [
  { id: 'black', name: 'Black', hex: '#121212', image: '/mockups/heavy-cotton-black.png' },
  { id: 'white', name: 'White', hex: '#FFFFFF', image: '/mockups/heavy-cotton-white.png' },
  { id: 'navy', name: 'Navy', hex: '#1e293b', image: '/mockups/heavy-cotton-navy.png' },
  { id: 'gray', name: 'Charcoal', hex: '#374151', image: '/mockups/heavy-cotton-gray.png' },
];

interface MockupCanvasProps {
  onDesignChange?: (hasDesign: boolean) => void;
}

const MockupCanvas = forwardRef<MockupCanvasRef, MockupCanvasProps>(
  ({ onDesignChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<Canvas | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    const [selectedColor, setSelectedColor] = useState<TShirtColor>(tshirtColors[0]);
    const [hasDesign, setHasDesign] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [zoom, setZoom] = useState(1);

    // Initialize Fabric canvas
    useEffect(() => {
      if (!canvasRef.current) return;

      const canvas = new Canvas(canvasRef.current, {
        width: 280,
        height: 320,
        backgroundColor: 'transparent',
        preserveObjectStacking: true,
        selection: true,
      });

      // Custom selection styling
      fabric.FabricObject.prototype.set({
        borderColor: '#84cc16',
        cornerColor: '#84cc16',
        cornerSize: 10,
        transparentCorners: false,
        cornerStyle: 'circle',
        borderScaleFactor: 2,
      });

      fabricCanvasRef.current = canvas;

      // Track design changes
      const updateDesignState = () => {
        const objectCount = canvas.getObjects().length;
        setHasDesign(objectCount > 0);
        onDesignChange?.(objectCount > 0);
      };

      canvas.on('object:added', updateDesignState);
      canvas.on('object:removed', updateDesignState);

      // Keyboard shortcuts
      const handleKeyDown = (e: KeyboardEvent) => {
        const activeObject = canvas.getActiveObject();
        
        if ((e.key === 'Delete' || e.key === 'Backspace') && activeObject) {
          e.preventDefault();
          canvas.remove(activeObject);
          canvas.requestRenderAll();
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        canvas.dispose();
      };
    }, [onDesignChange]);

    const addImage = async (url: string): Promise<void> => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          try {
            // Scale image to fit nicely in the print zone
            const maxWidth = 200;
            const maxHeight = 240;
            let scale = 1;
            
            if (img.width > maxWidth || img.height > maxHeight) {
              scale = Math.min(maxWidth / img.width, maxHeight / img.height);
            }

            const fabricImg = new FabricImage(img, {
              left: canvas.width! / 2,
              top: canvas.height! / 2,
              originX: 'center',
              originY: 'center',
              scaleX: scale,
              scaleY: scale,
            });
            
            canvas.add(fabricImg);
            canvas.setActiveObject(fabricImg);
            canvas.requestRenderAll();
            toast.success('Design added! Drag to position.');
            resolve();
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = url;
      });
    };

    const exportDesign = (): string | null => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return null;

      return canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 3,
      });
    };

    const exportDesignOnly = (): string | null => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return null;

      // Export only the design objects (no background)
      return canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 4, // High res for printing
      });
    };

    const clear = () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      canvas.clear();
      canvas.requestRenderAll();
    };

    // File upload handler
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        addImage(url);
      };
      reader.readAsDataURL(file);
      
      // Reset input
      e.target.value = '';
    };

    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const url = event.target?.result as string;
          addImage(url);
        };
        reader.readAsDataURL(file);
      } else if (file) {
        toast.error('Please drop an image file (PNG, JPG, GIF, etc.)');
      }
    };

    const handleExport = () => {
      const dataUrl = exportDesignOnly();
      if (dataUrl) {
        // Create download link
        const link = document.createElement('a');
        link.download = 'alternate-design.png';
        link.href = dataUrl;
        link.click();
        toast.success('Design exported! Ready for printing.');
      }
    };

    const handleZoom = (direction: 'in' | 'out') => {
      setZoom(prev => {
        const newZoom = direction === 'in' ? prev + 0.1 : prev - 0.1;
        return Math.max(0.5, Math.min(1.5, newZoom));
      });
    };

    useImperativeHandle(ref, () => ({
      canvas: fabricCanvasRef.current,
      addImage,
      exportDesign,
      exportDesignOnly,
      clear,
    }));

    return (
      <div className="flex flex-col items-center gap-6 p-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase tracking-wider">
            Alternate <span className="text-primary">Studio</span>
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Design your drip. We print it.</p>
        </div>

        {/* Workspace Container */}
        <div 
          ref={containerRef}
          className={cn(
            "relative rounded-xl overflow-hidden shadow-2xl border-2 transition-all duration-300",
            isDragOver ? "border-primary scale-[1.02]" : "border-border"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{ transform: `scale(${zoom})` }}
        >
          {/* T-Shirt Background Layer */}
          <div 
            className="relative flex items-center justify-center"
            style={{
              width: '400px',
              height: '500px',
              backgroundColor: selectedColor.hex,
            }}
          >
            {/* T-shirt mockup image */}
            <img
              src={selectedColor.image}
              alt={`${selectedColor.name} t-shirt`}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />

            {/* Print Zone Indicator */}
            <div 
              className={cn(
                "absolute border-2 border-dashed rounded-lg transition-colors",
                isDragOver ? "border-primary bg-primary/10" : "border-zinc-600/50"
              )}
              style={{
                top: '100px',
                width: '280px',
                height: '320px',
              }}
            >
              {/* The Interactive Canvas */}
              <canvas ref={canvasRef} className="block" />

              {/* Drop Overlay */}
              {isDragOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/20 rounded-lg">
                  <div className="bg-background/90 px-4 py-3 rounded-lg text-center">
                    <Upload className="w-8 h-8 text-primary mx-auto mb-2" />
                    <p className="text-primary font-medium text-sm">Drop your design here</p>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!hasDesign && !isDragOver && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center text-muted-foreground/60">
                    <Upload className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Drag & drop your design</p>
                    <p className="text-xs">or use upload button below</p>
                  </div>
                </div>
              )}
            </div>

            {/* Shadow overlay for realism */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse at 50% 30%, transparent 40%, rgba(0,0,0,0.15) 100%)",
              }}
            />
          </div>
        </div>

        {/* Color Selector */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">T-Shirt Color:</span>
          <div className="flex gap-2">
            {tshirtColors.map((color) => (
              <button
                key={color.id}
                onClick={() => setSelectedColor(color)}
                className={cn(
                  "w-10 h-10 rounded-full border-2 transition-all hover:scale-110",
                  selectedColor.id === color.id 
                    ? "border-primary ring-2 ring-primary/30" 
                    : "border-border"
                )}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Upload Button */}
          <label className="cursor-pointer">
            <Button variant="outline" className="gap-2" asChild>
              <span>
                <Upload className="w-4 h-4" />
                Upload Art
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </span>
            </Button>
          </label>

          {/* Zoom Controls */}
          <div className="flex items-center border border-border rounded-lg">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9"
              onClick={() => handleZoom('out')}
              disabled={zoom <= 0.5}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="px-2 text-xs text-muted-foreground min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9"
              onClick={() => handleZoom('in')}
              disabled={zoom >= 1.5}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>

          {/* Clear Button */}
          {hasDesign && (
            <Button variant="ghost" size="icon" onClick={clear} title="Clear design">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}

          {/* Export/Order Button */}
          <Button 
            onClick={handleExport}
            disabled={!hasDesign}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_0_15px_rgba(132,204,22,0.3)]"
          >
            <Download className="w-4 h-4" />
            Export Design
          </Button>
        </div>

        {/* Info */}
        <p className="text-xs text-muted-foreground text-center max-w-md">
          Position your design within the print zone. Click and drag to move, use corners to resize.
          Press Delete to remove selected design.
        </p>
      </div>
    );
  }
);

MockupCanvas.displayName = 'MockupCanvas';

export default MockupCanvas;
