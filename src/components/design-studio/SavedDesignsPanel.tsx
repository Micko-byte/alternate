import { useState, useEffect } from "react";
import { FolderOpen, Save, Trash2, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DesignCanvasRef } from "./DesignCanvas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface SavedDesignsPanelProps {
  canvasRef: DesignCanvasRef | null;
}

interface SavedDesign {
  id: string;
  name: string;
  design_json: unknown;
  created_at: string;
}

const SavedDesignsPanel = ({ canvasRef }: SavedDesignsPanelProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [designName, setDesignName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadDesigns();
    }
  }, [user]);

  const loadDesigns = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_designs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDesigns(data || []);
    } catch (error) {
      console.error('Error loading designs:', error);
      toast.error("Failed to load saved designs");
    } finally {
      setIsLoading(false);
    }
  };

  const saveDesign = async () => {
    if (!user) {
      toast.error("Please sign in to save designs");
      return;
    }

    if (!canvasRef?.canvas) {
      toast.error("Canvas not ready");
      return;
    }

    const name = designName.trim() || `Design ${new Date().toLocaleDateString()}`;
    
    setIsSaving(true);
    try {
      const designJson = canvasRef.canvas.toJSON();
      
      const { error } = await supabase
        .from('saved_designs')
        .insert({
          user_id: user.id,
          name,
          design_json: designJson,
        });

      if (error) throw error;

      toast.success("Design saved!");
      setDesignName("");
      loadDesigns();
    } catch (error) {
      console.error('Error saving design:', error);
      toast.error("Failed to save design");
    } finally {
      setIsSaving(false);
    }
  };

  const loadDesign = (design: SavedDesign) => {
    if (!canvasRef) {
      toast.error("Canvas not ready");
      return;
    }

    canvasRef.loadTemplate(design.design_json as object);
    toast.success(`Loaded: ${design.name}`);
  };

  const deleteDesign = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from('saved_designs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Design deleted");
      setDesigns(designs.filter(d => d.id !== id));
    } catch (error) {
      console.error('Error deleting design:', error);
      toast.error("Failed to delete design");
    }
  };

  if (!user) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FolderOpen className="w-4 h-4" />
          <span>My Designs</span>
        </div>
        
        <div className="p-4 bg-muted/50 rounded-lg text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Sign in to save and load your designs
          </p>
          <Button onClick={() => navigate('/auth')} size="sm">
            <LogIn className="w-4 h-4 mr-2" />
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <FolderOpen className="w-4 h-4" />
        <span>My Designs</span>
      </div>

      {/* Save current design */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Save current design</Label>
        <div className="flex gap-2">
          <Input
            value={designName}
            onChange={(e) => setDesignName(e.target.value)}
            placeholder="Design name..."
            className="flex-1 h-9 text-sm bg-background"
          />
          <Button 
            size="sm" 
            onClick={saveDesign}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Saved designs list */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          Saved designs ({designs.length})
        </Label>
        
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : designs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No saved designs yet
          </p>
        ) : (
          <div className="space-y-1 max-h-[250px] overflow-y-auto">
            {designs.map((design) => (
              <div
                key={design.id}
                className="flex items-center justify-between p-2 bg-muted hover:bg-accent rounded-lg cursor-pointer transition-colors group"
                onClick={() => loadDesign(design)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{design.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(design.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => deleteDesign(design.id, e)}
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedDesignsPanel;
