import { 
  RotateCw, 
  RotateCcw, 
  FlipHorizontal, 
  FlipVertical, 
  Maximize2, 
  Minimize2,
  Move,
  Copy,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DesignCanvasRef } from "./DesignCanvas";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface TransformToolsProps {
  canvasRef: DesignCanvasRef | null;
}

const TransformTools = ({ canvasRef }: TransformToolsProps) => {
  const [hasSelection, setHasSelection] = useState(false);
  const [scaleValue, setScaleValue] = useState([100]);
  const [rotationValue, setRotationValue] = useState([0]);

  useEffect(() => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;

    const updateSelection = () => {
      const activeObject = canvas.getActiveObject();
      setHasSelection(!!activeObject && activeObject.selectable !== false);
      
      if (activeObject && activeObject.selectable !== false) {
        setScaleValue([Math.round((activeObject.scaleX || 1) * 100)]);
        setRotationValue([Math.round(activeObject.angle || 0)]);
      }
    };

    canvas.on("selection:created", updateSelection);
    canvas.on("selection:updated", updateSelection);
    canvas.on("selection:cleared", () => {
      setHasSelection(false);
      setScaleValue([100]);
      setRotationValue([0]);
    });
    canvas.on("object:modified", updateSelection);

    return () => {
      canvas.off("selection:created", updateSelection);
      canvas.off("selection:updated", updateSelection);
      canvas.off("selection:cleared");
      canvas.off("object:modified", updateSelection);
    };
  }, [canvasRef]);

  const getActiveObject = () => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return null;
    const obj = canvas.getActiveObject();
    return obj && obj.selectable !== false ? obj : null;
  };

  const handleRotate = (degrees: number) => {
    const obj = getActiveObject();
    if (!obj || !canvasRef?.canvas) return;
    obj.rotate((obj.angle || 0) + degrees);
    canvasRef.canvas.renderAll();
    setRotationValue([Math.round(obj.angle || 0)]);
  };

  const handleFlipHorizontal = () => {
    const obj = getActiveObject();
    if (!obj || !canvasRef?.canvas) return;
    obj.set("flipX", !obj.flipX);
    canvasRef.canvas.renderAll();
  };

  const handleFlipVertical = () => {
    const obj = getActiveObject();
    if (!obj || !canvasRef?.canvas) return;
    obj.set("flipY", !obj.flipY);
    canvasRef.canvas.renderAll();
  };

  const handleScaleUp = () => {
    const obj = getActiveObject();
    if (!obj || !canvasRef?.canvas) return;
    obj.scale((obj.scaleX || 1) * 1.1);
    canvasRef.canvas.renderAll();
    setScaleValue([Math.round((obj.scaleX || 1) * 100)]);
  };

  const handleScaleDown = () => {
    const obj = getActiveObject();
    if (!obj || !canvasRef?.canvas) return;
    obj.scale((obj.scaleX || 1) * 0.9);
    canvasRef.canvas.renderAll();
    setScaleValue([Math.round((obj.scaleX || 1) * 100)]);
  };

  const handleScaleChange = (value: number[]) => {
    const obj = getActiveObject();
    if (!obj || !canvasRef?.canvas) return;
    const scale = value[0] / 100;
    obj.scale(scale);
    canvasRef.canvas.renderAll();
    setScaleValue(value);
  };

  const handleRotationChange = (value: number[]) => {
    const obj = getActiveObject();
    if (!obj || !canvasRef?.canvas) return;
    obj.rotate(value[0]);
    canvasRef.canvas.renderAll();
    setRotationValue(value);
  };

  const handleDuplicate = () => {
    const obj = getActiveObject();
    if (!obj || !canvasRef?.canvas) return;
    
    obj.clone().then((cloned: any) => {
      cloned.set({
        left: (obj.left || 0) + 20,
        top: (obj.top || 0) + 20,
      });
      canvasRef.canvas?.add(cloned);
      canvasRef.canvas?.setActiveObject(cloned);
      canvasRef.canvas?.renderAll();
      toast.success("Object duplicated");
    });
  };

  const handleDelete = () => {
    const obj = getActiveObject();
    if (!obj || !canvasRef?.canvas) return;
    canvasRef.canvas.remove(obj);
    canvasRef.canvas.renderAll();
    toast.success("Object deleted");
  };

  const handleCenterObject = () => {
    const obj = getActiveObject();
    const canvas = canvasRef?.canvas;
    if (!obj || !canvas) return;
    
    const canvasWidth = canvas.width || 500;
    const canvasHeight = canvas.height || 600;
    const objWidth = (obj.width || 0) * (obj.scaleX || 1);
    const objHeight = (obj.height || 0) * (obj.scaleY || 1);
    
    obj.set({
      left: (canvasWidth - objWidth) / 2,
      top: (canvasHeight - objHeight) / 2,
    });
    canvas.renderAll();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">Transform</span>
        {!hasSelection && (
          <span className="text-[10px] text-muted-foreground">Select an object</span>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-5 gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleRotate(-15)}
              disabled={!hasSelection}
              className="h-8 w-8"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Rotate Left</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleRotate(15)}
              disabled={!hasSelection}
              className="h-8 w-8"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Rotate Right</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleFlipHorizontal}
              disabled={!hasSelection}
              className="h-8 w-8"
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Flip Horizontal</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleFlipVertical}
              disabled={!hasSelection}
              className="h-8 w-8"
            >
              <FlipVertical className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Flip Vertical</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCenterObject}
              disabled={!hasSelection}
              className="h-8 w-8"
            >
              <Move className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Center</TooltipContent>
        </Tooltip>
      </div>

      {/* Scale Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Scale</span>
          <span className="text-xs font-mono">{scaleValue[0]}%</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleScaleDown}
            disabled={!hasSelection}
            className="h-6 w-6"
          >
            <Minimize2 className="w-3 h-3" />
          </Button>
          <Slider
            value={scaleValue}
            onValueChange={handleScaleChange}
            min={10}
            max={300}
            step={5}
            disabled={!hasSelection}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleScaleUp}
            disabled={!hasSelection}
            className="h-6 w-6"
          >
            <Maximize2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Rotation Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Rotation</span>
          <span className="text-xs font-mono">{rotationValue[0]}°</span>
        </div>
        <Slider
          value={rotationValue}
          onValueChange={handleRotationChange}
          min={0}
          max={360}
          step={1}
          disabled={!hasSelection}
        />
      </div>

      {/* Object Actions */}
      <div className="flex gap-2 pt-2 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDuplicate}
          disabled={!hasSelection}
          className="flex-1"
        >
          <Copy className="w-3.5 h-3.5 mr-1" />
          Duplicate
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={!hasSelection}
          className="flex-1"
        >
          <Trash2 className="w-3.5 h-3.5 mr-1" />
          Delete
        </Button>
      </div>
    </div>
  );
};

export default TransformTools;
