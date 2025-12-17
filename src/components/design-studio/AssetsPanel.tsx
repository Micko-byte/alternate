import { useState, useRef } from "react";
import { Images, Upload, Star, Zap, Heart, Crown, Flame, Music, Skull, Target, Shield, Trophy, Swords, Eye, Ghost, Sparkles, Hexagon, Diamond, Circle, Square, Triangle, Bomb, Rocket, Crosshair, Wifi, Radio, Disc } from "lucide-react";
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
      id: "skull",
      name: "Skull",
      icon: Skull,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="100" height="100"><circle cx="9" cy="10" r="2"/><circle cx="15" cy="10" r="2"/><path d="M12 2C6.48 2 2 6.48 2 12v6c0 1.1.9 2 2 2h3v-2H4v-6c0-4.42 3.58-8 8-8s8 3.58 8 8v6h-3v2h3c1.1 0 2-.9 2-2v-6c0-5.52-4.48-10-10-10z"/><path d="M9 16h6v2H9z"/></svg>`,
    },
    {
      id: "target",
      name: "Target",
      icon: Target,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="100" height="100"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    },
    {
      id: "eye",
      name: "All-Seeing Eye",
      icon: Eye,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="100" height="100"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`,
    },
    {
      id: "ghost",
      name: "Ghost",
      icon: Ghost,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="100" height="100"><path d="M12 2C7.03 2 3 6.03 3 11v9l2.5-2.5L8 20l4-4 4 4 2.5-2.5L21 20v-9c0-4.97-4.03-9-9-9zm-2 9c-.83 0-1.5-.67-1.5-1.5S9.17 8 10 8s1.5.67 1.5 1.5S10.83 11 10 11zm4 0c-.83 0-1.5-.67-1.5-1.5S13.17 8 14 8s1.5.67 1.5 1.5S14.83 11 14 11z"/></svg>`,
    },
    {
      id: "bomb",
      name: "Bomb",
      icon: Bomb,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="100" height="100"><circle cx="11" cy="13" r="9"/><path d="M15 3h4v2h-4z"/><path d="M14 4l2-2 2 2-2 2z"/><path d="M13 5l3 3"/></svg>`,
    },
    {
      id: "rocket",
      name: "Rocket",
      icon: Rocket,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="100" height="100"><path d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
    },
    {
      id: "sparkles",
      name: "Sparkles",
      icon: Sparkles,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="100" height="100"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75L19 13z"/><path d="M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17z"/></svg>`,
    },
  ],
  badges: [
    {
      id: "shield",
      name: "Shield",
      icon: Shield,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="100" height="100"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>`,
    },
    {
      id: "trophy",
      name: "Trophy",
      icon: Trophy,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="100" height="100"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>`,
    },
    {
      id: "swords",
      name: "Crossed Swords",
      icon: Swords,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="100" height="100"><path d="M6.92 5L5 6.92l3.54 3.54L5 14l1.41 1.41L10 12l1.41 1.41-3.54 3.54L9.29 18.37 12 15.66l2.71 2.71 1.42-1.42-3.54-3.54L14 12l3.59 3.41L19 14l-3.54-3.54L19 6.92 17.08 5l-3.54 3.54L12 7.13 10.46 8.67 6.92 5z"/></svg>`,
    },
    {
      id: "hexagon-badge",
      name: "Hex Badge",
      icon: Hexagon,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="100" height="100"><path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18s-.41-.06-.57-.18l-7.9-4.44A.991.991 0 013 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18s.41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9z"/></svg>`,
    },
    {
      id: "diamond-badge",
      name: "Diamond",
      icon: Diamond,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="100" height="100"><path d="M12 2L2 12l10 10 10-10L12 2z"/></svg>`,
    },
    {
      id: "circle-badge",
      name: "Circle Badge",
      icon: Circle,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="45" fill="currentColor"/><circle cx="50" cy="50" r="35" fill="none" stroke="#000" stroke-width="3"/></svg>`,
    },
    {
      id: "crosshair",
      name: "Crosshair",
      icon: Crosshair,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="100" height="100"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>`,
    },
    {
      id: "wifi-waves",
      name: "Signal",
      icon: Wifi,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="100" height="100"><path d="M12 18c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0-4c2.21 0 4 1.79 4 4h-2c0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4zm0-4c3.31 0 6 2.69 6 6h-2c0-2.21-1.79-4-4-4s-4 1.79-4 4H6c0-3.31 2.69-6 6-6zm0-4c4.42 0 8 3.58 8 8h-2c0-3.31-2.69-6-6-6s-6 2.69-6 6H4c0-4.42 3.58-8 8-8z"/></svg>`,
    },
    {
      id: "vinyl",
      name: "Vinyl",
      icon: Disc,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="45" fill="currentColor"/><circle cx="50" cy="50" r="15" fill="#000"/><circle cx="50" cy="50" r="5" fill="currentColor"/></svg>`,
    },
  ],
  symbols: [
    {
      id: "peace",
      name: "Peace",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="currentColor" width="100" height="100"><circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="6"/><line x1="50" y1="5" x2="50" y2="95" stroke="currentColor" stroke-width="6"/><line x1="50" y1="50" x2="20" y2="80" stroke="currentColor" stroke-width="6"/><line x1="50" y1="50" x2="80" y2="80" stroke="currentColor" stroke-width="6"/></svg>`,
    },
    {
      id: "yin-yang",
      name: "Yin Yang",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="45" fill="currentColor"/><path d="M50 5 A45 45 0 0 1 50 95 A22.5 22.5 0 0 1 50 50 A22.5 22.5 0 0 0 50 5" fill="#000"/><circle cx="50" cy="27.5" r="8" fill="#000"/><circle cx="50" cy="72.5" r="8" fill="currentColor"/></svg>`,
    },
    {
      id: "anarchy",
      name: "Anarchy",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="4"/><text x="50" y="70" font-size="60" text-anchor="middle" fill="currentColor" font-family="Arial Black">A</text></svg>`,
    },
    {
      id: "infinity",
      name: "Infinity",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="100" height="50"><path d="M25 25 C25 10 10 10 10 25 S25 40 25 25 C25 10 40 10 40 25 S25 40 25 25" fill="none" stroke="currentColor" stroke-width="6" transform="translate(30, 0) scale(1.2)"/></svg>`,
    },
    {
      id: "x-mark",
      name: "X Mark",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><line x1="20" y1="20" x2="80" y2="80" stroke="currentColor" stroke-width="12" stroke-linecap="round"/><line x1="80" y1="20" x2="20" y2="80" stroke="currentColor" stroke-width="12" stroke-linecap="round"/></svg>`,
    },
    {
      id: "arrow-up",
      name: "Arrow Up",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M50 10 L80 50 L60 50 L60 90 L40 90 L40 50 L20 50 Z" fill="currentColor"/></svg>`,
    },
    {
      id: "drip",
      name: "Drip",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="100" height="120"><ellipse cx="50" cy="30" rx="35" ry="25" fill="currentColor"/><path d="M20 30 Q15 60 25 90 Q30 110 50 115 Q70 110 75 90 Q85 60 80 30" fill="currentColor"/></svg>`,
    },
    {
      id: "three-lines",
      name: "Three Lines",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect x="10" y="20" width="80" height="12" rx="6" fill="currentColor"/><rect x="10" y="44" width="80" height="12" rx="6" fill="currentColor"/><rect x="10" y="68" width="80" height="12" rx="6" fill="currentColor"/></svg>`,
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
    {
      id: "checkerboard",
      name: "Checker",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect fill="#84cc16" x="0" y="0" width="25" height="25"/><rect fill="#84cc16" x="50" y="0" width="25" height="25"/><rect fill="#84cc16" x="25" y="25" width="25" height="25"/><rect fill="#84cc16" x="75" y="25" width="25" height="25"/><rect fill="#84cc16" x="0" y="50" width="25" height="25"/><rect fill="#84cc16" x="50" y="50" width="25" height="25"/><rect fill="#84cc16" x="25" y="75" width="25" height="25"/><rect fill="#84cc16" x="75" y="75" width="25" height="25"/></svg>`,
    },
    {
      id: "diagonal-lines",
      name: "Diagonal",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><line x1="0" y1="0" x2="100" y2="100" stroke="#ec4899" stroke-width="8"/><line x1="25" y1="0" x2="100" y2="75" stroke="#ec4899" stroke-width="8"/><line x1="50" y1="0" x2="100" y2="50" stroke="#ec4899" stroke-width="8"/><line x1="0" y1="25" x2="75" y2="100" stroke="#ec4899" stroke-width="8"/><line x1="0" y1="50" x2="50" y2="100" stroke="#ec4899" stroke-width="8"/></svg>`,
    },
    {
      id: "zigzag",
      name: "Zigzag",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><polyline points="0,25 25,50 50,25 75,50 100,25" fill="none" stroke="#facc15" stroke-width="8"/><polyline points="0,50 25,75 50,50 75,75 100,50" fill="none" stroke="#facc15" stroke-width="8"/><polyline points="0,75 25,100 50,75 75,100 100,75" fill="none" stroke="#facc15" stroke-width="8"/></svg>`,
    },
    {
      id: "grid",
      name: "Grid",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><line x1="25" y1="0" x2="25" y2="100" stroke="#84cc16" stroke-width="4"/><line x1="50" y1="0" x2="50" y2="100" stroke="#84cc16" stroke-width="4"/><line x1="75" y1="0" x2="75" y2="100" stroke="#84cc16" stroke-width="4"/><line x1="0" y1="25" x2="100" y2="25" stroke="#84cc16" stroke-width="4"/><line x1="0" y1="50" x2="100" y2="50" stroke="#84cc16" stroke-width="4"/><line x1="0" y1="75" x2="100" y2="75" stroke="#84cc16" stroke-width="4"/></svg>`,
    },
    {
      id: "waves",
      name: "Waves",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M0 30 Q25 10 50 30 T100 30" fill="none" stroke="#06b6d4" stroke-width="6"/><path d="M0 50 Q25 30 50 50 T100 50" fill="none" stroke="#06b6d4" stroke-width="6"/><path d="M0 70 Q25 50 50 70 T100 70" fill="none" stroke="#06b6d4" stroke-width="6"/></svg>`,
    },
    {
      id: "stars-pattern",
      name: "Stars",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><polygon fill="#facc15" points="25,5 28,15 38,15 30,22 33,32 25,26 17,32 20,22 12,15 22,15"/><polygon fill="#facc15" points="75,5 78,15 88,15 80,22 83,32 75,26 67,32 70,22 62,15 72,15"/><polygon fill="#facc15" points="50,35 53,45 63,45 55,52 58,62 50,56 42,62 45,52 37,45 47,45"/><polygon fill="#facc15" points="25,65 28,75 38,75 30,82 33,92 25,86 17,92 20,82 12,75 22,75"/><polygon fill="#facc15" points="75,65 78,75 88,75 80,82 83,92 75,86 67,92 70,82 62,75 72,75"/></svg>`,
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
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="icons" className="text-xs">
            Icons
          </TabsTrigger>
          <TabsTrigger value="badges" className="text-xs">
            Badges
          </TabsTrigger>
          <TabsTrigger value="symbols" className="text-xs">
            Symbols
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

        <TabsContent value="badges" className="mt-3">
          <div className="grid grid-cols-3 gap-2">
            {shapes.badges.map((shape) => (
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

        <TabsContent value="symbols" className="mt-3">
          <div className="grid grid-cols-3 gap-2">
            {shapes.symbols.map((symbol) => (
              <button
                key={symbol.id}
                className="aspect-square flex items-center justify-center bg-muted hover:bg-accent rounded-lg border border-border transition-colors overflow-hidden"
                onClick={() => handleAddShape(symbol.svg)}
                title={symbol.name}
              >
                <img
                  src={createSvgDataUri(symbol.svg.replace(/currentColor/g, activeColor))}
                  alt={symbol.name}
                  className="w-8 h-8"
                />
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
