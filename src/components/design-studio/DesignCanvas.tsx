import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas as FabricCanvas, Rect, Circle, IText, FabricImage, PencilBrush } from "fabric";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";

export type ShirtZone = "front" | "back" | "left-sleeve" | "right-sleeve";

export interface DesignCanvasRef {
  canvas: FabricCanvas | null;
  addText: (text: string, options?: object) => void;
  addShape: (shape: "rectangle" | "circle") => void;
  addImage: (url: string) => void;
  setDrawingMode: (enabled: boolean) => void;
  setBrushColor: (color: string) => void;
  setBrushWidth: (width: number) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  exportImage: () => string | null;
  loadTemplate: (json: object) => void;
  getZoneData: () => Record<ShirtZone, string>;
}

interface DesignCanvasProps {
  activeColor: string;
  activeTool: "select" | "draw" | "text" | "rectangle" | "circle";
  activeZone: ShirtZone;
  onCanvasReady?: (ref: DesignCanvasRef) => void;
}

const zoneConfigs: Record<ShirtZone, { label: string; guideWidth: number; guideHeight: number; guidePosX: number; guidePosY: number }> = {
  front: { label: "Front", guideWidth: 400, guideHeight: 450, guidePosX: 50, guidePosY: 80 },
  back: { label: "Back", guideWidth: 400, guideHeight: 480, guidePosX: 50, guidePosY: 60 },
  "left-sleeve": { label: "Left Sleeve", guideWidth: 150, guideHeight: 200, guidePosX: 175, guidePosY: 200 },
  "right-sleeve": { label: "Right Sleeve", guideWidth: 150, guideHeight: 200, guidePosX: 175, guidePosY: 200 },
};

const DesignCanvas = ({ activeColor, activeTool, activeZone, onCanvasReady }: DesignCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use a ref for the fabric instance to avoid closure staleness in event handlers
  const fabricRef = useRef<FabricCanvas | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const historyLocked = useRef(false);
  
  const isMobile = useIsMobile();

  // Helper to save history
  const saveHistory = useCallback(() => {
    if (!fabricRef.current || historyLocked.current) return;
    
    const json = JSON.stringify(fabricRef.current.toJSON());
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(json);
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  // Initialize Canvas
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const initCanvas = () => {
      const containerWidth = containerRef.current?.clientWidth || 0;
      if (containerWidth === 0) return;

      // Dispose old canvas if exists to prevent duplicates
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }

      const maxWidth = Math.min(containerWidth - 16, 500);
      const canvasWidth = isMobile ? Math.min(280, maxWidth) : 500;
      const canvasHeight = isMobile ? Math.round(canvasWidth * 1.2) : 600;

      const canvas = new FabricCanvas(canvasRef.current!, {
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: "#1a1a1a",
        selection: true,
        allowTouchScrolling: false, // Must be false for drawing to work on mobile
        preserveObjectStacking: true,
      });

      // Setup Brush
      canvas.freeDrawingBrush = new PencilBrush(canvas);
      canvas.freeDrawingBrush.color = activeColor;
      canvas.freeDrawingBrush.width = 3;

      // Setup Events
      canvas.on("object:added", () => saveHistory());
      canvas.on("object:modified", () => saveHistory());
      canvas.on("object:removed", () => saveHistory());

      // Initialize History
      historyRef.current = [JSON.stringify(canvas.toJSON())];
      historyIndexRef.current = 0;

      fabricRef.current = canvas;
      setIsReady(true);
    };

    // Use ResizeObserver instead of recursive requestAnimationFrame
    const resizeObserver = new ResizeObserver(() => {
      if (!fabricRef.current) {
        initCanvas();
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
      setIsReady(false);
    };
  }, [isMobile, activeColor, saveHistory]);

  // Handle Tool & Color Updates
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = activeTool === "draw";
    
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = activeColor;
    }
    
    const activeObj = canvas.getActiveObject();
    if (activeObj && (activeObj.type === 'rect' || activeObj.type === 'circle' || activeObj.type === 'i-text')) {
      activeObj.set('fill', activeColor);
      canvas.requestRenderAll();
    }
  }, [activeTool, activeColor]);

  // Handle Zone Guides
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !isReady) return;

    const scale = canvas.width / 500;
    const config = zoneConfigs[activeZone];

    // Remove old guide
    canvas.getObjects().forEach(obj => {
      if (!obj.selectable && obj.type === 'rect' && obj.strokeDashArray) {
        canvas.remove(obj);
      }
    });

    // Add new guide
    const zoneGuide = new Rect({
      left: config.guidePosX * scale,
      top: config.guidePosY * scale,
      width: config.guideWidth * scale,
      height: config.guideHeight * scale,
      fill: "transparent",
      stroke: "hsl(142, 76%, 36%)",
      strokeWidth: 2,
      strokeDashArray: [10, 5],
      selectable: false,
      evented: false,
    });

    canvas.add(zoneGuide);
    canvas.sendObjectToBack(zoneGuide);
    canvas.requestRenderAll();
  }, [activeZone, isReady, isMobile]);

  // Expose API via ref
  useEffect(() => {
    if (!fabricRef.current || !onCanvasReady) return;

    const canvas = fabricRef.current;
    const scale = canvas.width / 500;

    const api: DesignCanvasRef = {
      canvas,
      addText: (text) => {
        const textObj = new IText(text, {
          left: 150 * scale,
          top: 250 * scale,
          fill: activeColor,
          fontFamily: "Arial",
          fontSize: 48 * scale,
        });
        canvas.add(textObj);
        canvas.setActiveObject(textObj);
      },
      addShape: (shape) => {
        let obj;
        if (shape === "rectangle") {
          obj = new Rect({ left: 150 * scale, top: 200 * scale, fill: activeColor, width: 100 * scale, height: 100 * scale });
        } else {
          obj = new Circle({ left: 200 * scale, top: 250 * scale, fill: activeColor, radius: 50 * scale });
        }
        canvas.add(obj);
        canvas.setActiveObject(obj);
      },
      addImage: async (url) => {
        try {
          const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
          img.scaleToWidth(200 * scale);
          img.set({ left: 150 * scale, top: 150 * scale });
          canvas.add(img);
          canvas.setActiveObject(img);
        } catch (e) {
          console.error('Failed to load image:', e);
        }
      },
      setDrawingMode: (enabled) => { canvas.isDrawingMode = enabled; },
      setBrushColor: (color) => { if (canvas.freeDrawingBrush) canvas.freeDrawingBrush.color = color; },
      setBrushWidth: (width) => { if (canvas.freeDrawingBrush) canvas.freeDrawingBrush.width = width; },
      undo: async () => {
        if (historyIndexRef.current > 0) {
          historyLocked.current = true;
          historyIndexRef.current--;
          await canvas.loadFromJSON(JSON.parse(historyRef.current[historyIndexRef.current]));
          canvas.requestRenderAll();
          historyLocked.current = false;
        }
      },
      redo: async () => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
          historyLocked.current = true;
          historyIndexRef.current++;
          await canvas.loadFromJSON(JSON.parse(historyRef.current[historyIndexRef.current]));
          canvas.requestRenderAll();
          historyLocked.current = false;
        }
      },
      clear: () => {
        canvas.clear();
        canvas.backgroundColor = "#1a1a1a";
        saveHistory();
      },
      exportImage: () => canvas.toDataURL({ format: "png", multiplier: 2 }),
      loadTemplate: (json) => {
        historyLocked.current = true;
        canvas.loadFromJSON(json).then(() => {
          canvas.requestRenderAll();
          saveHistory();
          historyLocked.current = false;
        });
      },
      getZoneData: () => ({ front: "", back: "", "left-sleeve": "", "right-sleeve": "" })
    };

    onCanvasReady(api);
  }, [activeColor, onCanvasReady, isReady, isMobile, saveHistory]);

  const config = zoneConfigs[activeZone];
  const canvasWidth = isMobile ? 280 : 500;
  const canvasHeight = isMobile ? 336 : 600;

  return (
    <div 
      ref={containerRef} 
      className="relative rounded-lg overflow-hidden border-2 border-border bg-card w-full flex justify-center"
      style={{ minHeight: canvasHeight }}
    >
      {/* Loading Overlay */}
      {!isReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground mt-2">Loading canvas...</span>
        </div>
      )}

      {/* Canvas Element - Always present */}
      <canvas 
        ref={canvasRef} 
        className={isReady ? "max-w-full" : "opacity-0"} 
        style={{ touchAction: 'none' }} 
      />

      {isReady && (
        <>
          <div className="absolute top-2 left-2 bg-background/80 px-2 py-1 rounded text-xs text-muted-foreground">
            {config.label}
          </div>
          <div className="absolute bottom-2 left-2 text-xs text-muted-foreground">
            {config.label} • {canvasWidth}×{canvasHeight}px
          </div>
        </>
      )}
    </div>
  );
};

export default DesignCanvas;
