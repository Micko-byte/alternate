import { useState } from "react";
import { Sparkles, Loader2, Wand2, Search, Image, Palette, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DesignCanvasRef } from "./DesignCanvas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AIGeneratePanelProps {
  canvasRef: DesignCanvasRef | null;
}

interface DesignReference {
  title: string;
  description: string;
  visualElements: string[];
  searchQuery: string;
  tags: string[];
  colorScheme: string[];
}

interface GeneratedImage {
  url: string;
  description?: string;
}

const AIGeneratePanel = ({ canvasRef }: AIGeneratePanelProps) => {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [references, setReferences] = useState<DesignReference[]>([]);
  const [activeTab, setActiveTab] = useState("generate");

  const handleGenerateImage = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a design idea");
      return;
    }

    setIsGenerating(true);
    setGeneratedImages([]);

    try {
      const { data, error } = await supabase.functions.invoke('generate-design-image', {
        body: { prompt }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.images && data.images.length > 0) {
        setGeneratedImages(data.images.map((url: string) => ({ 
          url, 
          description: data.description 
        })));
        toast.success("Design image generated!");
      } else {
        toast.info("No image generated. Try a different prompt.");
      }
    } catch (error) {
      console.error('Error generating image:', error);
      handleError(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSearchReferences = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a design idea");
      return;
    }

    setIsSearching(true);
    setReferences([]);

    try {
      const { data, error } = await supabase.functions.invoke('search-design-references', {
        body: { prompt }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setReferences(data.references || []);
      toast.success("Design references found!");
    } catch (error) {
      console.error('Error searching references:', error);
      handleError(error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleError = (error: unknown) => {
    if (error instanceof Error) {
      if (error.message.includes('Rate limit')) {
        toast.error("Too many requests. Please wait a moment.");
      } else if (error.message.includes('Payment')) {
        toast.error("AI credits exhausted. Please add more credits.");
      } else {
        toast.error("Failed to process. Try again.");
      }
    } else {
      toast.error("An error occurred");
    }
  };

  const addImageToCanvas = async (imageUrl: string) => {
    if (!canvasRef) {
      toast.error("Canvas not ready");
      return;
    }

    try {
      await canvasRef.addImage(imageUrl);
      toast.success("Image added to canvas!");
    } catch (error) {
      console.error('Error adding image:', error);
      toast.error("Failed to add image to canvas");
    }
  };

  const applyReference = (reference: DesignReference) => {
    if (!canvasRef) {
      toast.error("Canvas not ready");
      return;
    }

    // Add title text
    canvasRef.addText(reference.title.toUpperCase(), {
      top: 150,
      fill: reference.colorScheme[0] || '#84cc16',
      fontFamily: 'Bebas Neue',
      fontSize: 48,
    });

    // Add visual element hints as smaller text
    reference.visualElements.slice(0, 2).forEach((element, i) => {
      canvasRef.addText(element, {
        top: 220 + (i * 40),
        fill: reference.colorScheme[1] || '#ffffff',
        fontSize: 24,
      });
    });

    toast.success(`Applied: ${reference.title}`);
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
        <span>AI Design Studio</span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="generate" className="text-xs">
            <Image className="w-3 h-3 mr-1" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="search" className="text-xs">
            <Search className="w-3 h-3 mr-1" />
            Inspire
          </TabsTrigger>
        </TabsList>

        <div className="mt-3 space-y-3">
          <Label className="text-xs text-muted-foreground">Describe your design</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., A bold streetwear design with Japanese text and neon colors..."
            className="min-h-[80px] bg-background resize-none"
          />
          
          {/* Quick prompts */}
          <div className="flex flex-wrap gap-1">
            {promptExamples.map((example, i) => (
              <button
                key={i}
                onClick={() => setPrompt(example)}
                className="text-xs px-2 py-1 bg-muted hover:bg-accent rounded transition-colors"
              >
                {example.substring(0, 18)}...
              </button>
            ))}
          </div>
        </div>

        <TabsContent value="generate" className="mt-3 space-y-3">
          <Button 
            onClick={handleGenerateImage} 
            disabled={isGenerating || !prompt.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Image...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Generate Design
              </>
            )}
          </Button>

          {/* Generated Images */}
          {generatedImages.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Generated Designs</Label>
              <div className="grid gap-2">
                {generatedImages.map((image, i) => (
                  <div
                    key={i}
                    className="relative group rounded-lg overflow-hidden border border-border bg-muted"
                  >
                    <img 
                      src={image.url} 
                      alt={`Generated design ${i + 1}`}
                      className="w-full h-auto object-contain"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        size="sm"
                        onClick={() => addImageToCanvas(image.url)}
                        className="gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add to Canvas
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="search" className="mt-3 space-y-3">
          <Button 
            onClick={handleSearchReferences} 
            disabled={isSearching || !prompt.trim()}
            className="w-full"
            variant="secondary"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Finding Inspiration...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Find References
              </>
            )}
          </Button>

          {/* Reference Cards */}
          {references.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Design Inspiration</Label>
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {references.map((ref, i) => (
                  <div
                    key={i}
                    className="p-3 bg-muted rounded-lg border border-border hover:border-primary transition-colors cursor-pointer"
                    onClick={() => applyReference(ref)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-sm">{ref.title}</h4>
                      <div className="flex gap-1">
                        {ref.tags.slice(0, 2).map((tag, ti) => (
                          <span key={ti} className="text-xs px-1.5 py-0.5 bg-primary/20 text-primary rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{ref.description}</p>
                    
                    {/* Visual Elements */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {ref.visualElements.slice(0, 3).map((el, ei) => (
                        <span key={ei} className="text-xs px-1.5 py-0.5 bg-accent rounded">
                          {el}
                        </span>
                      ))}
                    </div>
                    
                    {/* Color Scheme */}
                    <div className="flex items-center gap-2">
                      <Palette className="w-3 h-3 text-muted-foreground" />
                      <div className="flex gap-1">
                        {ref.colorScheme.map((color, ci) => (
                          <div
                            key={ci}
                            className="w-4 h-4 rounded border border-border"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIGeneratePanel;
