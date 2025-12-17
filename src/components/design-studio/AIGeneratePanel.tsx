import { useState } from "react";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DesignCanvasRef } from "./DesignCanvas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AIGeneratePanelProps {
  canvasRef: DesignCanvasRef | null;
}

interface DesignSuggestion {
  title: string;
  description: string;
  elements: Array<{
    type: string;
    content?: string;
    style?: string;
    position?: string;
    shape?: string;
    color?: string;
    category?: string;
    suggestion?: string;
  }>;
  colorPalette: string[];
  mood: string;
}

const AIGeneratePanel = ({ canvasRef }: AIGeneratePanelProps) => {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<DesignSuggestion[]>([]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a design idea");
      return;
    }

    setIsGenerating(true);
    setSuggestions([]);

    try {
      const { data, error } = await supabase.functions.invoke('generate-design', {
        body: { prompt }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setSuggestions(data.suggestions || []);
      toast.success("Design suggestions generated!");
    } catch (error) {
      console.error('Error generating design:', error);
      if (error instanceof Error) {
        if (error.message.includes('Rate limit')) {
          toast.error("Too many requests. Please wait a moment.");
        } else if (error.message.includes('Payment')) {
          toast.error("AI credits exhausted. Please add more credits.");
        } else {
          toast.error("Failed to generate suggestions. Try again.");
        }
      } else {
        toast.error("Failed to generate suggestions");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const applySuggestion = (suggestion: DesignSuggestion) => {
    if (!canvasRef) {
      toast.error("Canvas not ready");
      return;
    }

    // Apply text elements
    suggestion.elements.forEach((element, index) => {
      if (element.type === 'text' && element.content) {
        const yOffset = index * 60;
        canvasRef.addText(element.content, {
          top: 150 + yOffset,
          fill: suggestion.colorPalette[0] || '#84cc16',
          fontFamily: element.style === 'bold' ? 'Bebas Neue' : 'Arial',
          fontSize: element.style === 'bold' ? 48 : 32,
        });
      } else if (element.type === 'shape' && element.shape) {
        canvasRef.addShape(element.shape as 'rectangle' | 'circle');
      }
    });

    toast.success(`Applied: ${suggestion.title}`);
  };

  const promptExamples = [
    "Bold urban streetwear with Japanese text",
    "Minimalist skull with neon accents",
    "Vintage 90s hip-hop aesthetic",
    "Abstract geometric patterns",
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Sparkles className="w-4 h-4 text-primary" />
        <span>AI Design Generator</span>
      </div>

      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Describe your design</Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., A bold streetwear design with Japanese text and neon colors..."
          className="min-h-[80px] bg-background resize-none"
        />
        
        <Button 
          onClick={handleGenerate} 
          disabled={isGenerating || !prompt.trim()}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Generate Ideas
            </>
          )}
        </Button>
      </div>

      {/* Quick prompts */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Quick ideas</Label>
        <div className="flex flex-wrap gap-1">
          {promptExamples.map((example, i) => (
            <button
              key={i}
              onClick={() => setPrompt(example)}
              className="text-xs px-2 py-1 bg-muted hover:bg-accent rounded transition-colors"
            >
              {example.substring(0, 20)}...
            </button>
          ))}
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground">Suggestions</Label>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {suggestions.map((suggestion, i) => (
              <div
                key={i}
                className="p-3 bg-muted rounded-lg border border-border hover:border-primary transition-colors cursor-pointer"
                onClick={() => applySuggestion(suggestion)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-sm">{suggestion.title}</h4>
                  <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">
                    {suggestion.mood}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{suggestion.description}</p>
                <div className="flex gap-1">
                  {suggestion.colorPalette.map((color, ci) => (
                    <div
                      key={ci}
                      className="w-5 h-5 rounded border border-border"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIGeneratePanel;
