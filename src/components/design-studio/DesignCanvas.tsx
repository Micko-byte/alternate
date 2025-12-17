import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas as FabricCanvas, Rect, Circle, IText, FabricImage, PencilBrush } from "fabric";

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
}

interface DesignCanvasProps {
  activeColor: string;
  activeTool: "select" | "draw" | "text" | "rectangle" | "circle";
  onCanvasReady?: (ref: DesignCanvasRef) => void;
}

const DesignCanvas = ({ activeColor, activeTool, onCanvasReady }: DesignCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);

  const saveHistory = useCallback(() => {
    if (!fabricCanvas) return;
    const json = JSON.stringify(fabricCanvas.toJSON());
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(json);
    historyIndexRef.current = historyRef.current.length - 1;
  }, [fabricCanvas]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 500,
      height: 600,
      backgroundColor: "#1a1a1a",
      selection: true,
    });

    // Initialize the freeDrawingBrush manually for Fabric.js v6
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = activeColor;
    canvas.freeDrawingBrush.width = 3;

    // Add t-shirt outline as guide
    const tshirtGuide = new Rect({
      left: 50,
      top: 80,
      width: 400,
      height: 450,
      fill: "transparent",
      stroke: "hsl(142, 76%, 36%)",
      strokeWidth: 2,
      strokeDashArray: [10, 5],
      selectable: false,
      evented: false,
    });
    canvas.add(tshirtGuide);

    canvas.on("object:added", () => saveHistory());
    canvas.on("object:modified", () => saveHistory());
    canvas.on("object:removed", () => saveHistory());

    setFabricCanvas(canvas);

    // Initial history state
    historyRef.current = [JSON.stringify(canvas.toJSON())];
    historyIndexRef.current = 0;

    return () => {
      canvas.dispose();
    };
  }, []);

  useEffect(() => {
    if (!fabricCanvas) return;
    fabricCanvas.isDrawingMode = activeTool === "draw";
    if (activeTool === "draw" && fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = activeColor;
    }
  }, [activeTool, activeColor, fabricCanvas]);

  useEffect(() => {
    if (!fabricCanvas) return;

    const canvasRefObj: DesignCanvasRef = {
      canvas: fabricCanvas,
      addText: (text: string, options = {}) => {
        const textObj = new IText(text, {
          left: 150,
          top: 250,
          fill: activeColor,
          fontFamily: "Bebas Neue",
          fontSize: 48,
          ...options,
        });
        fabricCanvas.add(textObj);
        fabricCanvas.setActiveObject(textObj);
        fabricCanvas.renderAll();
      },
      addShape: (shape: "rectangle" | "circle") => {
        if (shape === "rectangle") {
          const rect = new Rect({
            left: 150,
            top: 200,
            fill: activeColor,
            width: 100,
            height: 100,
          });
          fabricCanvas.add(rect);
          fabricCanvas.setActiveObject(rect);
        } else if (shape === "circle") {
          const circle = new Circle({
            left: 200,
            top: 250,
            fill: activeColor,
            radius: 50,
          });
          fabricCanvas.add(circle);
          fabricCanvas.setActiveObject(circle);
        }
        fabricCanvas.renderAll();
      },
      addImage: async (url: string) => {
        try {
          const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });
          img.scaleToWidth(200);
          img.set({ left: 150, top: 150 });
          fabricCanvas.add(img);
          fabricCanvas.setActiveObject(img);
          fabricCanvas.renderAll();
        } catch (error) {
          console.error("Failed to load image:", error);
        }
      },
      setDrawingMode: (enabled: boolean) => {
        fabricCanvas.isDrawingMode = enabled;
      },
      setBrushColor: (color: string) => {
        if (fabricCanvas.freeDrawingBrush) {
          fabricCanvas.freeDrawingBrush.color = color;
        }
      },
      setBrushWidth: (width: number) => {
        if (fabricCanvas.freeDrawingBrush) {
          fabricCanvas.freeDrawingBrush.width = width;
        }
      },
      undo: () => {
        if (historyIndexRef.current > 0) {
          historyIndexRef.current--;
          const json = historyRef.current[historyIndexRef.current];
          fabricCanvas.loadFromJSON(JSON.parse(json)).then(() => {
            fabricCanvas.renderAll();
          });
        }
      },
      redo: () => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
          historyIndexRef.current++;
          const json = historyRef.current[historyIndexRef.current];
          fabricCanvas.loadFromJSON(JSON.parse(json)).then(() => {
            fabricCanvas.renderAll();
          });
        }
      },
      clear: () => {
        fabricCanvas.clear();
        fabricCanvas.backgroundColor = "#1a1a1a";
        // Re-add t-shirt guide
        const tshirtGuide = new Rect({
          left: 50,
          top: 80,
          width: 400,
          height: 450,
          fill: "transparent",
          stroke: "hsl(142, 76%, 36%)",
          strokeWidth: 2,
          strokeDashArray: [10, 5],
          selectable: false,
          evented: false,
        });
        fabricCanvas.add(tshirtGuide);
        fabricCanvas.renderAll();
        saveHistory();
      },
      exportImage: () => {
        return fabricCanvas.toDataURL({
          format: "png",
          quality: 1,
          multiplier: 2,
        });
      },
      loadTemplate: (json: object) => {
        fabricCanvas.loadFromJSON(json).then(() => {
          fabricCanvas.renderAll();
          saveHistory();
        });
      },
    };

    onCanvasReady?.(canvasRefObj);
  }, [fabricCanvas, activeColor, onCanvasReady, saveHistory]);

  return (
    <div className="relative rounded-lg overflow-hidden border-2 border-border bg-card">
      <canvas ref={canvasRef} className="max-w-full" />
      <div className="absolute bottom-2 left-2 text-xs text-muted-foreground">
        Design Area • 500×600px
      </div>
    </div>
  );
};

export default DesignCanvas;
