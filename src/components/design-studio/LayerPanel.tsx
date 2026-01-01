import { useState, useEffect } from "react";
import { Layers, Eye, EyeOff, Lock, Unlock, Trash2, ArrowUp, ArrowDown, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DesignCanvasRef } from "./DesignCanvas";
import { toast } from "sonner";
import { FabricObject } from "fabric";

interface LayerPanelProps {
  canvasRef: DesignCanvasRef | null;
}

interface LayerItem {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  locked: boolean;
  object: FabricObject;
}

const LayerPanel = ({ canvasRef }: LayerPanelProps) => {
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // Sync layers with canvas objects
  const syncLayers = () => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;

    const objects = canvas.getObjects();
    const layerItems: LayerItem[] = objects
      .filter(obj => obj.selectable !== false) // Skip non-selectable items like guides
      .map((obj, index) => {
        const objData = (obj as any).data || {};
        return {
          id: objData.layerId || `layer-${index}`,
          name: getObjectName(obj, index),
          type: obj.type || "unknown",
          visible: obj.visible !== false,
          locked: !obj.selectable,
          object: obj,
        };
      })
      .reverse(); // Reverse so top layer is first

    setLayers(layerItems);
  };

  // Get friendly name for object
  const getObjectName = (obj: FabricObject, index: number): string => {
    const type = obj.type || "Object";
    
    if (type === "i-text" || type === "text") {
      const text = (obj as any).text || "";
      return text.length > 15 ? text.substring(0, 15) + "..." : text || `Text ${index + 1}`;
    }
    
    if (type === "rect") return `Rectangle ${index + 1}`;
    if (type === "circle") return `Circle ${index + 1}`;
    if (type === "image") return `Image ${index + 1}`;
    if (type === "group") return `Group ${index + 1}`;
    if (type === "path") return `Path ${index + 1}`;
    
    return `${type} ${index + 1}`;
  };

  // Listen for canvas changes
  useEffect(() => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;

    const handleUpdate = () => syncLayers();

    canvas.on("object:added", handleUpdate);
    canvas.on("object:removed", handleUpdate);
    canvas.on("object:modified", handleUpdate);
    canvas.on("selection:created", handleUpdate);
    canvas.on("selection:updated", handleUpdate);
    canvas.on("selection:cleared", handleUpdate);

    // Initial sync
    syncLayers();

    return () => {
      canvas.off("object:added", handleUpdate);
      canvas.off("object:removed", handleUpdate);
      canvas.off("object:modified", handleUpdate);
      canvas.off("selection:created", handleUpdate);
      canvas.off("selection:updated", handleUpdate);
      canvas.off("selection:cleared", handleUpdate);
    };
  }, [canvasRef]);

  // Select layer on canvas
  const selectLayer = (layer: LayerItem) => {
    const canvas = canvasRef?.canvas;
    if (!canvas || layer.locked) return;

    canvas.setActiveObject(layer.object);
    canvas.requestRenderAll();
    setSelectedLayerId(layer.id);
  };

  // Toggle layer visibility
  const toggleVisibility = (layer: LayerItem) => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;

    layer.object.set("visible", !layer.visible);
    canvas.requestRenderAll();
    syncLayers();
  };

  // Toggle layer lock
  const toggleLock = (layer: LayerItem) => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;

    const newLocked = !layer.locked;
    layer.object.set({
      selectable: !newLocked,
      evented: !newLocked,
    });
    
    if (newLocked) {
      canvas.discardActiveObject();
    }
    
    canvas.requestRenderAll();
    syncLayers();
    toast.success(newLocked ? "Layer locked" : "Layer unlocked");
  };

  // Delete layer
  const deleteLayer = (layer: LayerItem) => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;

    canvas.remove(layer.object);
    canvas.requestRenderAll();
    toast.success("Layer deleted");
  };

  // Move layer up (forward in z-index)
  const moveUp = (layer: LayerItem) => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;

    canvas.bringObjectForward(layer.object);
    canvas.requestRenderAll();
    syncLayers();
  };

  // Move layer down (backward in z-index)
  const moveDown = (layer: LayerItem) => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;

    canvas.sendObjectBackwards(layer.object);
    canvas.requestRenderAll();
    syncLayers();
  };

  // Duplicate layer
  const duplicateLayer = async (layer: LayerItem) => {
    const canvas = canvasRef?.canvas;
    if (!canvas) return;

    try {
      const cloned = await layer.object.clone();
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
      });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.requestRenderAll();
      toast.success("Layer duplicated");
    } catch (error) {
      console.error("Failed to duplicate:", error);
    }
  };

  // Get icon color based on type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "i-text":
      case "text":
        return "T";
      case "rect":
        return "□";
      case "circle":
        return "○";
      case "image":
        return "🖼";
      case "group":
        return "⊞";
      case "path":
        return "✏";
      default:
        return "◇";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Layers className="w-4 h-4" />
        <span>Layers</span>
        <span className="text-xs text-muted-foreground ml-auto">{layers.length}</span>
      </div>

      <Label className="text-xs text-muted-foreground">
        Click to select, drag to reorder
      </Label>

      <ScrollArea className="h-[250px] pr-2">
        <div className="space-y-1">
          {layers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              No layers yet. Add text, shapes, or images.
            </div>
          ) : (
            layers.map((layer) => (
              <div
                key={layer.id}
                className={`group flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                  selectedLayerId === layer.id
                    ? "bg-primary/20 border border-primary"
                    : "bg-muted/50 hover:bg-muted border border-transparent"
                } ${layer.locked ? "opacity-60" : ""}`}
                onClick={() => selectLayer(layer)}
              >
                {/* Type Icon */}
                <span className="w-5 h-5 flex items-center justify-center text-xs bg-background rounded">
                  {getTypeIcon(layer.type)}
                </span>

                {/* Name */}
                <span className="flex-1 text-xs truncate">{layer.name}</span>

                {/* Actions (show on hover) */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisibility(layer);
                    }}
                  >
                    {layer.visible ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLock(layer);
                    }}
                  >
                    {layer.locked ? (
                      <Lock className="w-3 h-3" />
                    ) : (
                      <Unlock className="w-3 h-3" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateLayer(layer);
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteLayer(layer);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      {layers.length > 0 && (
        <div className="flex gap-1 pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => layers[0] && moveUp(layers[0])}
          >
            <ArrowUp className="w-3 h-3 mr-1" />
            Up
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => layers[0] && moveDown(layers[0])}
          >
            <ArrowDown className="w-3 h-3 mr-1" />
            Down
          </Button>
        </div>
      )}
    </div>
  );
};

export default LayerPanel;
