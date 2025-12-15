import { useState, useRef } from "react";
import { Images, Upload, Star, Zap, Heart, Crown, Flame, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DesignCanvasRef } from "./DesignCanvas";
import { toast } from "sonner";

interface AssetsPanelProps {
  canvasRef: DesignCanvasRef | null;
  activeColor: string;
}

// SVG shapes as data URIs
const createSvgDataUri = (svgContent: string): string => {
  const encoded = encodeURIComponent(svgContent);
  return `data:image/svg+xml,${encoded}`;
};

const shapes = {
  icons: [
    {
      id: "star",
      name: "Star",
      icon: Star,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="100" height="100"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    },
    {
      id: "bolt",
      name: "Lightning",
      icon: Zap,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="100" height="100"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    },
    {
      id: "heart",
      name: "Heart",
      icon: Heart,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="100" height="100"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    },
    {
      id: "crown",
      name: "Crown",
      icon: Crown,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="100" height="100"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 14h14v2H5v-2z"/></svg>`,
    },
    {
      id: "flame",
      name: "Fire",
      icon: Flame,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="100" height="100"><path d="M12 23c-4.97 0-9-3.58-9-8 0-3.97 2.83-7.04 4.5-9.5.83-1.23 2.5-1.23 3.33 0 .72 1.07 1.67 2.33 2.67 4C15 7 16 5 16 5s2 2.33 3 4.5c1 2.17 1.5 4.5 1.5 6.5 0 4.42-4.03 7-8.5 7z"/></svg>`,
    },
    {
      id: "music",
      name: "Music",
      icon: Music,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="100" height="100"><path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/></svg>`,
    },
  ],
  patterns: [
    {
      id: "stripes",
      name: "Stripes",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect fill="#84cc16" x="0" y="0" width="20" height="100"/><rect fill="#84cc16" x="40" y="0" width="20" height="100"/><rect fill="#84cc16" x="80" y="0" width="20" height="100"/></svg>`,
    },
    {
      id: "dots",
      name: "Dots",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle fill="#ec4899" cx="25" cy="25" r="10"/><circle fill="#ec4899" cx="75" cy="25" r="10"/><circle fill="#ec4899" cx="50" cy="50" r="10"/><circle fill="#ec4899" cx="25" cy="75" r="10"/><circle fill="#ec4899" cx="75" cy="75" r="10"/></svg>`,
    },
    {
      id: "triangles",
      name: "Triangles",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><polygon fill="#facc15" points="50,10 90,90 10,90"/></svg>`,
    },
  ],
};

const AssetsPanel = ({ canvasRef, activeColor }: AssetsPanelProps) => {
  const [selectedCategory, setSelectedCategory] = useState("icons");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddShape = (svg: string) => {
    if (!canvasRef) return;
    const coloredSvg = svg.replace(/currentColor/g, activeColor);
    const dataUri = createSvgDataUri(coloredSvg);
    canvasRef.addImage(dataUri);
    toast.success("Shape added to canvas");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      canvasRef?.addImage(dataUrl);
      toast.success("Image added to canvas");
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Images className="w-4 h-4" />
        <span>Graphics</span>
      </div>

      {/* Upload Button */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Upload Image</Label>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />
        <Button
          variant="outline"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Image
        </Button>
      </div>

      {/* Asset Categories */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="icons" className="text-xs">
            Icons
          </TabsTrigger>
          <TabsTrigger value="patterns" className="text-xs">
            Patterns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="icons" className="mt-3">
          <div className="grid grid-cols-3 gap-2">
            {shapes.icons.map((shape) => (
              <button
                key={shape.id}
                className="aspect-square flex items-center justify-center bg-muted hover:bg-accent rounded-lg border border-border transition-colors"
                onClick={() => handleAddShape(shape.svg)}
                title={shape.name}
              >
                <shape.icon className="w-6 h-6" style={{ color: activeColor }} />
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="patterns" className="mt-3">
          <div className="grid grid-cols-3 gap-2">
            {shapes.patterns.map((pattern) => (
              <button
                key={pattern.id}
                className="aspect-square flex items-center justify-center bg-muted hover:bg-accent rounded-lg border border-border transition-colors overflow-hidden"
                onClick={() => handleAddShape(pattern.svg)}
                title={pattern.name}
              >
                <img
                  src={createSvgDataUri(pattern.svg)}
                  alt={pattern.name}
                  className="w-8 h-8"
                />
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Tips */}
      <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
        <p className="font-medium mb-1">💡 Tips</p>
        <ul className="space-y-1">
          <li>• Click any shape to add it</li>
          <li>• Upload your own images</li>
          <li>• Drag to reposition</li>
        </ul>
      </div>
    </div>
  );
};

export default AssetsPanel;
