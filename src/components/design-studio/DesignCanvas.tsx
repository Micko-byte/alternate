import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Canvas, FabricObject, IText, Rect, Circle } from 'fabric';
import * as fabric from 'fabric';

export interface DesignCanvasRef {
  canvas: Canvas | null;
  addText: (text: string, options?: Partial<IText>) => void;
  addImage: (url: string) => Promise<void>;
  addShape: (type: 'rect' | 'circle', options?: any) => void;
  exportImage: (format?: 'png' | 'jpeg') => string | null;
  exportPrintFile: () => string | null;
  clear: () => void;
  undo: () => void;
  redo: () => void;
  loadTemplate: (template: any) => void;
  getActiveObject: () => FabricObject | null;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
}

interface DesignCanvasProps {
  width?: number;
  height?: number;
  backgroundColor?: string;
  onSelectionChange?: (hasSelection: boolean) => void;
}

const DesignCanvas = forwardRef<DesignCanvasRef, DesignCanvasProps>(
  ({ width = 500, height = 600, backgroundColor = '#1a1a1a', onSelectionChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<Canvas | null>(null);
    const historyRef = useRef<string[]>([]);
    const historyStepRef = useRef<number>(-1);

    // Initialize Fabric canvas
    useEffect(() => {
      if (!canvasRef.current) return;

      const canvas = new Canvas(canvasRef.current, {
        width,
        height,
        backgroundColor,
        preserveObjectStacking: true,
        selection: true,
      });

      fabricCanvasRef.current = canvas;

      // Selection events
      canvas.on('selection:created', () => onSelectionChange?.(true));
      canvas.on('selection:updated', () => onSelectionChange?.(true));
      canvas.on('selection:cleared', () => onSelectionChange?.(false));

      // History tracking
      const saveState = () => {
        const json = JSON.stringify(canvas.toJSON());
        historyRef.current = historyRef.current.slice(0, historyStepRef.current + 1);
        historyRef.current.push(json);
        historyStepRef.current++;
        
        // Limit history to 50 steps
        if (historyRef.current.length > 50) {
          historyRef.current.shift();
          historyStepRef.current--;
        }
      };

      canvas.on('object:added', saveState);
      canvas.on('object:modified', saveState);
      canvas.on('object:removed', saveState);

      // Save initial state
      saveState();

      // Keyboard shortcuts
      const handleKeyDown = (e: KeyboardEvent) => {
        const activeObject = canvas.getActiveObject();
        
        // Delete
        if ((e.key === 'Delete' || e.key === 'Backspace') && activeObject) {
          canvas.remove(activeObject);
          canvas.requestRenderAll();
        }
        
        // Undo/Redo
        if (e.ctrlKey || e.metaKey) {
          if (e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            if (historyStepRef.current > 0) {
              historyStepRef.current--;
              const state = historyRef.current[historyStepRef.current];
              canvas.loadFromJSON(state).then(() => {
                canvas.requestRenderAll();
              });
            }
          } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
            e.preventDefault();
            if (historyStepRef.current < historyRef.current.length - 1) {
              historyStepRef.current++;
              const state = historyRef.current[historyStepRef.current];
              canvas.loadFromJSON(state).then(() => {
                canvas.requestRenderAll();
              });
            }
          }
          // Duplicate
          else if (e.key === 'd') {
            e.preventDefault();
            if (activeObject) {
              activeObject.clone().then((cloned: FabricObject) => {
                cloned.set({
                  left: (cloned.left || 0) + 10,
                  top: (cloned.top || 0) + 10,
                });
                canvas.add(cloned);
                canvas.setActiveObject(cloned);
                canvas.requestRenderAll();
              });
            }
          }
        }

        // Arrow keys for precise movement
        if (activeObject && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const left = activeObject.left || 0;
          const top = activeObject.top || 0;

          switch (e.key) {
            case 'ArrowUp':
              activeObject.set('top', top - step);
              break;
            case 'ArrowDown':
              activeObject.set('top', top + step);
              break;
            case 'ArrowLeft':
              activeObject.set('left', left - step);
              break;
            case 'ArrowRight':
              activeObject.set('left', left + step);
              break;
          }
          
          activeObject.setCoords();
          canvas.requestRenderAll();
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        canvas.dispose();
      };
    }, [width, height, backgroundColor, onSelectionChange]);

    const addText = (text: string, options?: Partial<IText>) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const textObj = new IText(text, {
        left: width / 2 - 100,
        top: height / 2 - 25,
        fontSize: 48,
        fontFamily: 'Bebas Neue, Arial Black, sans-serif',
        fill: '#ffffff',
        ...options,
      });

      canvas.add(textObj);
      canvas.setActiveObject(textObj);
      canvas.requestRenderAll();
    };

    const addImage = async (url: string): Promise<void> => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          try {
            const fabricImg = new fabric.FabricImage(img, {
              left: width / 2 - img.width / 4,
              top: height / 2 - img.height / 4,
              scaleX: 0.5,
              scaleY: 0.5,
            });
            canvas.add(fabricImg);
            canvas.setActiveObject(fabricImg);
            canvas.requestRenderAll();
            resolve();
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = url;
      });
    };

    const addShape = (type: 'rect' | 'circle', options?: any) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      let shape: FabricObject;

      if (type === 'rect') {
        shape = new Rect({
          left: width / 2 - 50,
          top: height / 2 - 50,
          width: 100,
          height: 100,
          fill: '#84cc16',
          ...options,
        });
      } else {
        shape = new Circle({
          left: width / 2 - 50,
          top: height / 2 - 50,
          radius: 50,
          fill: '#84cc16',
          ...options,
        });
      }

      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.requestRenderAll();
    };

    const exportImage = (format: 'png' | 'jpeg' = 'png'): string | null => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return null;

      return canvas.toDataURL({
        format,
        quality: 1,
        multiplier: 2, // 2x resolution for better quality
      });
    };

    const exportPrintFile = (): string | null => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return null;

      // Export at 300 DPI for print quality
      return canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 4, // High resolution for printing
      });
    };

    const clear = () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      canvas.clear();
      canvas.backgroundColor = backgroundColor;
      canvas.requestRenderAll();
    };

    const undo = () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      if (historyStepRef.current > 0) {
        historyStepRef.current--;
        const state = historyRef.current[historyStepRef.current];
        canvas.loadFromJSON(state).then(() => {
          canvas.requestRenderAll();
        });
      }
    };

    const redo = () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      if (historyStepRef.current < historyRef.current.length - 1) {
        historyStepRef.current++;
        const state = historyRef.current[historyStepRef.current];
        canvas.loadFromJSON(state).then(() => {
          canvas.requestRenderAll();
        });
      }
    };

    const loadTemplate = (template: any) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      canvas.loadFromJSON(template).then(() => {
        canvas.requestRenderAll();
      });
    };

    const getActiveObject = (): FabricObject | null => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return null;
      return canvas.getActiveObject();
    };

    const deleteSelected = () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        canvas.remove(activeObject);
        canvas.requestRenderAll();
      }
    };

    const duplicateSelected = () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const activeObject = canvas.getActiveObject();
      if (!activeObject) return;

      activeObject.clone().then((cloned: FabricObject) => {
        cloned.set({
          left: (cloned.left || 0) + 10,
          top: (cloned.top || 0) + 10,
        });
        canvas.add(cloned);
        canvas.setActiveObject(cloned);
        canvas.requestRenderAll();
      });
    };

    const bringToFront = () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        canvas.bringObjectToFront(activeObject);
        canvas.requestRenderAll();
      }
    };

    const sendToBack = () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        canvas.sendObjectToBack(activeObject);
        canvas.requestRenderAll();
      }
    };

    useImperativeHandle(ref, () => ({
      canvas: fabricCanvasRef.current,
      addText,
      addImage,
      addShape,
      exportImage,
      exportPrintFile,
      clear,
      undo,
      redo,
      loadTemplate,
      getActiveObject,
      deleteSelected,
      duplicateSelected,
      bringToFront,
      sendToBack,
    }));

    return (
      <div className="relative bg-muted rounded-lg border border-border overflow-hidden">
        <canvas ref={canvasRef} />
        
        {/* Grid overlay for alignment */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(0deg, transparent 24px, rgba(255, 255, 255, .05) 25px),
              linear-gradient(90deg, transparent 24px, rgba(255, 255, 255, .05) 25px)
            `,
            backgroundSize: '25px 25px',
          }}
        />
      </div>
    );
  }
);

DesignCanvas.displayName = 'DesignCanvas';

export default DesignCanvas;
