import { useState, useEffect } from "react";
import { LayoutTemplate, Sparkles, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { DesignCanvasRef } from "./DesignCanvas";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TemplatesPanelProps {
  canvasRef: DesignCanvasRef | null;
}

interface DesignTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  preview_url: string | null;
  config: Record<string, unknown>;
  is_premium: boolean;
}

// Fallback blank template
const blankTemplate = {
  id: "blank",
  name: "Blank Canvas",
  description: "Start from scratch",
  preview_url: null,
  config: {
    version: "6.0.0",
    objects: [],
    background: "#1a1a1a",
  },
};

const TemplatesPanel = ({ canvasRef }: TemplatesPanelProps) => {
  const [templates, setTemplates] = useState<DesignTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTemplates = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("design_templates")
        .select("*")
        .eq("category", "streetwear")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to fetch templates:", error);
        toast.error("Could not load templates");
      }

      if (data) {
        setTemplates(data as DesignTemplate[]);
      }
      setIsLoading(false);
    };

    fetchTemplates();
  }, []);

  const handleLoadTemplate = (template: DesignTemplate | typeof blankTemplate) => {
    if (!canvasRef) return;

    canvasRef.clear();
    const config = template.config as { objects?: unknown[] };
    if (config.objects && config.objects.length > 0) {
      canvasRef.loadTemplate(template.config);
    }
    toast.success(`"${template.name}" template loaded`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <LayoutTemplate className="w-4 h-4" />
        <span>Templates</span>
      </div>

      <Label className="text-xs text-muted-foreground">
        Start with a pre-designed layout
      </Label>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        /* Templates Grid */
        <div className="grid grid-cols-2 gap-2">
          {templates.map((template) => (
            <button
              key={template.id}
              className="group p-3 bg-muted hover:bg-accent rounded-lg border border-border hover:border-primary transition-all text-left"
              onClick={() => handleLoadTemplate(template)}
            >
              <div className="aspect-square bg-background rounded flex items-center justify-center mb-2 overflow-hidden">
                {template.preview_url ? (
                  <img
                    src={template.preview_url}
                    alt={template.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <span className="text-2xl font-display text-primary group-hover:scale-105 transition-transform">
                    {template.name.charAt(0)}
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-foreground truncate">
                {template.name}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {template.description}
              </p>
            </button>
          ))}

          {/* Blank Canvas option */}
          <button
            className="group p-3 bg-muted hover:bg-accent rounded-lg border border-border hover:border-primary transition-all text-left"
            onClick={() => handleLoadTemplate(blankTemplate)}
          >
            <div className="aspect-square bg-background rounded flex items-center justify-center mb-2 text-2xl font-display text-primary group-hover:scale-105 transition-transform">
              ✨
            </div>
            <p className="text-xs font-medium text-foreground truncate">
              Blank Canvas
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              Start from scratch
            </p>
          </button>
        </div>
      )}

      {/* Pro Tip */}
      <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
        <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-xs">
          <p className="font-medium text-foreground">Pro Tip</p>
          <p className="text-muted-foreground">
            Templates are starting points. Customize everything after loading!
          </p>
        </div>
      </div>
    </div>
  );
};

export default TemplatesPanel;
