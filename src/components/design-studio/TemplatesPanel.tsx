import { LayoutTemplate, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { DesignCanvasRef } from "./DesignCanvas";
import { toast } from "sonner";

interface TemplatesPanelProps {
  canvasRef: DesignCanvasRef | null;
}

// Pre-built template configurations (Fabric.js JSON format)
const templates = [
  {
    id: "minimal",
    name: "Minimal",
    preview: "A",
    description: "Clean centered text",
    config: {
      version: "6.0.0",
      objects: [
        {
          type: "i-text",
          left: 180,
          top: 280,
          text: "ALTERNATE",
          fill: "#ffffff",
          fontFamily: "Bebas Neue",
          fontSize: 56,
        },
      ],
      background: "#1a1a1a",
    },
  },
  {
    id: "bold-stack",
    name: "Bold Stack",
    preview: "B",
    description: "Stacked bold text",
    config: {
      version: "6.0.0",
      objects: [
        {
          type: "i-text",
          left: 150,
          top: 200,
          text: "STAY",
          fill: "#84cc16",
          fontFamily: "Bebas Neue",
          fontSize: 72,
        },
        {
          type: "i-text",
          left: 150,
          top: 280,
          text: "FRESH",
          fill: "#ffffff",
          fontFamily: "Bebas Neue",
          fontSize: 72,
        },
      ],
      background: "#1a1a1a",
    },
  },
  {
    id: "neon-glow",
    name: "Neon Vibe",
    preview: "N",
    description: "Neon accent style",
    config: {
      version: "6.0.0",
      objects: [
        {
          type: "rect",
          left: 125,
          top: 220,
          width: 250,
          height: 120,
          fill: "transparent",
          stroke: "#ec4899",
          strokeWidth: 3,
        },
        {
          type: "i-text",
          left: 175,
          top: 255,
          text: "LIMITED",
          fill: "#ec4899",
          fontFamily: "Bebas Neue",
          fontSize: 48,
        },
      ],
      background: "#1a1a1a",
    },
  },
  {
    id: "street-badge",
    name: "Street Badge",
    preview: "S",
    description: "Urban badge look",
    config: {
      version: "6.0.0",
      objects: [
        {
          type: "circle",
          left: 175,
          top: 175,
          radius: 100,
          fill: "transparent",
          stroke: "#facc15",
          strokeWidth: 4,
        },
        {
          type: "i-text",
          left: 185,
          top: 250,
          text: "AUTHENTIC",
          fill: "#facc15",
          fontFamily: "Bebas Neue",
          fontSize: 32,
        },
        {
          type: "i-text",
          left: 215,
          top: 290,
          text: "2024",
          fill: "#ffffff",
          fontFamily: "Bebas Neue",
          fontSize: 24,
        },
      ],
      background: "#1a1a1a",
    },
  },
  {
    id: "urban-split",
    name: "Urban Split",
    preview: "U",
    description: "Contrast split design",
    config: {
      version: "6.0.0",
      objects: [
        {
          type: "rect",
          left: 50,
          top: 200,
          width: 200,
          height: 150,
          fill: "#84cc16",
        },
        {
          type: "i-text",
          left: 80,
          top: 250,
          text: "URBAN",
          fill: "#000000",
          fontFamily: "Bebas Neue",
          fontSize: 48,
        },
        {
          type: "i-text",
          left: 280,
          top: 250,
          text: "EDGE",
          fill: "#ffffff",
          fontFamily: "Bebas Neue",
          fontSize: 48,
        },
      ],
      background: "#1a1a1a",
    },
  },
  {
    id: "blank",
    name: "Blank Canvas",
    preview: "✨",
    description: "Start from scratch",
    config: {
      version: "6.0.0",
      objects: [],
      background: "#1a1a1a",
    },
  },
];

const TemplatesPanel = ({ canvasRef }: TemplatesPanelProps) => {
  const handleLoadTemplate = (template: (typeof templates)[0]) => {
    if (!canvasRef) return;
    
    // Clear and load template
    canvasRef.clear();
    if (template.config.objects.length > 0) {
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

      {/* Templates Grid */}
      <div className="grid grid-cols-2 gap-2">
        {templates.map((template) => (
          <button
            key={template.id}
            className="group p-3 bg-muted hover:bg-accent rounded-lg border border-border hover:border-primary transition-all text-left"
            onClick={() => handleLoadTemplate(template)}
          >
            <div className="aspect-square bg-background rounded flex items-center justify-center mb-2 text-2xl font-display text-primary group-hover:scale-105 transition-transform">
              {template.preview}
            </div>
            <p className="text-xs font-medium text-foreground truncate">
              {template.name}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {template.description}
            </p>
          </button>
        ))}
      </div>

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
