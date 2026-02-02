import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import * as THREE from 'three';

export interface DesignObject {
  id: number;
  type: 'text' | 'shape' | 'image';
  x: number;
  y: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  shape?: 'rect' | 'circle';
  width?: number;
  height?: number;
  radius?: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  imageUrl?: string;
  rotation?: number;
}

export interface DesignCanvas2DRef {
  getTexture: () => THREE.Texture | null;
  addText: (text: string, options?: Partial<DesignObject>) => void;
  addShape: (shape: 'rect' | 'circle', options?: Partial<DesignObject>) => void;
  addImage: (url: string) => Promise<void>;
  clear: () => void;
  getObjects: () => DesignObject[];
  setObjects: (objects: DesignObject[]) => void;
  deleteObject: (id: number) => void;
  updateObject: (id: number, updates: Partial<DesignObject>) => void;
  exportPNG: () => string;
}

interface DesignCanvas2DProps {
  width?: number;
  height?: number;
  backgroundColor?: string;
  onObjectSelect?: (obj: DesignObject | null) => void;
  onTextureUpdate?: (texture: THREE.Texture) => void;
}

const DesignCanvas2D = forwardRef<DesignCanvas2DRef, DesignCanvas2DProps>(
  ({ width = 512, height = 512, backgroundColor = 'transparent', onObjectSelect, onTextureUpdate }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [objects, setObjects] = useState<DesignObject[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const textureRef = useRef<THREE.Texture | null>(null);
    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

    // Initialize and render canvas
    useEffect(() => {
      renderCanvas();
    }, [objects, selectedId]);

    // Update texture for 3D view
    useEffect(() => {
      if (canvasRef.current) {
        const texture = new THREE.CanvasTexture(canvasRef.current);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        textureRef.current = texture;
        onTextureUpdate?.(texture);
      }
    }, [objects, onTextureUpdate]);

    const renderCanvas = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear with transparent background (design will be projected onto shirt)
      ctx.clearRect(0, 0, width, height);
      
      if (backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
      }

      // Draw all objects
      for (const obj of objects) {
        ctx.save();
        
        // Apply rotation if set
        if (obj.rotation) {
          const centerX = obj.x + (obj.width || 0) / 2;
          const centerY = obj.y + (obj.height || 0) / 2;
          ctx.translate(centerX, centerY);
          ctx.rotate(obj.rotation);
          ctx.translate(-centerX, -centerY);
        }

        if (obj.type === 'text' && obj.text) {
          const fontSize = obj.fontSize || 48;
          ctx.font = `bold ${fontSize}px ${obj.fontFamily || 'Arial Black'}`;
          ctx.fillStyle = obj.fill;
          ctx.textBaseline = 'top';
          ctx.fillText(obj.text, obj.x, obj.y);

          // Selection highlight
          if (selectedId === obj.id) {
            const metrics = ctx.measureText(obj.text);
            ctx.strokeStyle = '#84cc16';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(obj.x - 4, obj.y - 4, metrics.width + 8, fontSize + 8);
            ctx.setLineDash([]);
          }
        } else if (obj.type === 'shape') {
          ctx.fillStyle = obj.fill;
          
          if (obj.shape === 'rect') {
            ctx.fillRect(obj.x, obj.y, obj.width || 100, obj.height || 100);
            if (obj.stroke && obj.strokeWidth) {
              ctx.strokeStyle = obj.stroke;
              ctx.lineWidth = obj.strokeWidth;
              ctx.strokeRect(obj.x, obj.y, obj.width || 100, obj.height || 100);
            }
          } else if (obj.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(obj.x + (obj.radius || 50), obj.y + (obj.radius || 50), obj.radius || 50, 0, Math.PI * 2);
            ctx.fill();
            if (obj.stroke && obj.strokeWidth) {
              ctx.strokeStyle = obj.stroke;
              ctx.lineWidth = obj.strokeWidth;
              ctx.stroke();
            }
          }

          // Selection highlight
          if (selectedId === obj.id) {
            ctx.strokeStyle = '#84cc16';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            if (obj.shape === 'circle') {
              ctx.beginPath();
              ctx.arc(obj.x + (obj.radius || 50), obj.y + (obj.radius || 50), (obj.radius || 50) + 4, 0, Math.PI * 2);
              ctx.stroke();
            } else {
              ctx.strokeRect(obj.x - 4, obj.y - 4, (obj.width || 100) + 8, (obj.height || 100) + 8);
            }
            ctx.setLineDash([]);
          }
        } else if (obj.type === 'image' && obj.imageUrl) {
          let img = imageCache.current.get(obj.imageUrl);
          
          if (!img) {
            img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = obj.imageUrl;
            imageCache.current.set(obj.imageUrl, img);
            img.onload = () => renderCanvas();
          }
          
          if (img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, obj.x, obj.y, obj.width || 100, obj.height || 100);
          }

          // Selection highlight
          if (selectedId === obj.id) {
            ctx.strokeStyle = '#84cc16';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(obj.x - 4, obj.y - 4, (obj.width || 100) + 8, (obj.height || 100) + 8);
            ctx.setLineDash([]);
          }
        }

        ctx.restore();
      }

      // Update texture
      if (textureRef.current) {
        textureRef.current.needsUpdate = true;
      }
    };

    const getObjectAt = (x: number, y: number): DesignObject | null => {
      // Check in reverse order (top to bottom)
      for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        const bounds = getObjectBounds(obj);
        if (bounds && x >= bounds.x && x <= bounds.x + bounds.width &&
            y >= bounds.y && y <= bounds.y + bounds.height) {
          return obj;
        }
      }
      return null;
    };

    const getObjectBounds = (obj: DesignObject) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      if (obj.type === 'text' && obj.text) {
        ctx.font = `bold ${obj.fontSize || 48}px ${obj.fontFamily || 'Arial Black'}`;
        const metrics = ctx.measureText(obj.text);
        return { x: obj.x, y: obj.y, width: metrics.width, height: obj.fontSize || 48 };
      } else if (obj.type === 'shape') {
        if (obj.shape === 'circle') {
          const r = obj.radius || 50;
          return { x: obj.x, y: obj.y, width: r * 2, height: r * 2 };
        }
        return { x: obj.x, y: obj.y, width: obj.width || 100, height: obj.height || 100 };
      } else if (obj.type === 'image') {
        return { x: obj.x, y: obj.y, width: obj.width || 100, height: obj.height || 100 };
      }
      return null;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      const clickedObj = getObjectAt(x, y);
      
      if (clickedObj) {
        setSelectedId(clickedObj.id);
        setIsDragging(true);
        setDragOffset({ x: x - clickedObj.x, y: y - clickedObj.y });
        onObjectSelect?.(clickedObj);
      } else {
        setSelectedId(null);
        onObjectSelect?.(null);
      }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging || selectedId === null) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      setObjects(prev => prev.map(obj => 
        obj.id === selectedId
          ? { ...obj, x: x - dragOffset.x, y: y - dragOffset.y }
          : obj
      ));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    // Handle file drop
    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const url = event.target?.result as string;
          const newObj: DesignObject = {
            id: Date.now(),
            type: 'image',
            x: width / 2 - 75,
            y: height / 2 - 75,
            width: 150,
            height: 150,
            imageUrl: url,
            fill: '#ffffff'
          };
          setObjects(prev => [...prev, newObj]);
        };
        reader.readAsDataURL(file);
      }
    };

    useImperativeHandle(ref, () => ({
      getTexture: () => textureRef.current,
      
      addText: (text: string, options?: Partial<DesignObject>) => {
        const newObj: DesignObject = {
          id: Date.now(),
          type: 'text',
          text,
          x: width / 2 - 100,
          y: height / 2 - 25,
          fontSize: 48,
          fontFamily: 'Arial Black',
          fill: '#ffffff',
          ...options
        };
        setObjects(prev => [...prev, newObj]);
        setSelectedId(newObj.id);
      },

      addShape: (shape: 'rect' | 'circle', options?: Partial<DesignObject>) => {
        const newObj: DesignObject = {
          id: Date.now(),
          type: 'shape',
          shape,
          x: width / 2 - 50,
          y: height / 2 - 50,
          width: shape === 'rect' ? 100 : undefined,
          height: shape === 'rect' ? 100 : undefined,
          radius: shape === 'circle' ? 50 : undefined,
          fill: '#84cc16',
          ...options
        };
        setObjects(prev => [...prev, newObj]);
        setSelectedId(newObj.id);
      },

      addImage: async (url: string) => {
        return new Promise((resolve) => {
          const newObj: DesignObject = {
            id: Date.now(),
            type: 'image',
            x: width / 2 - 75,
            y: height / 2 - 75,
            width: 150,
            height: 150,
            imageUrl: url,
            fill: '#ffffff'
          };
          setObjects(prev => [...prev, newObj]);
          setSelectedId(newObj.id);
          resolve();
        });
      },

      clear: () => {
        setObjects([]);
        setSelectedId(null);
      },

      getObjects: () => objects,

      setObjects: (newObjects: DesignObject[]) => {
        setObjects(newObjects);
      },

      deleteObject: (id: number) => {
        setObjects(prev => prev.filter(obj => obj.id !== id));
        if (selectedId === id) setSelectedId(null);
      },

      updateObject: (id: number, updates: Partial<DesignObject>) => {
        setObjects(prev => prev.map(obj => 
          obj.id === id ? { ...obj, ...updates } : obj
        ));
      },

      exportPNG: () => {
        return canvasRef.current?.toDataURL('image/png') || '';
      }
    }));

    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border border-border rounded-lg cursor-crosshair bg-zinc-900"
        style={{ maxWidth: '100%', height: 'auto' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      />
    );
  }
);

DesignCanvas2D.displayName = 'DesignCanvas2D';

export default DesignCanvas2D;
