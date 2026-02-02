import { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Wand2, Sparkles } from 'lucide-react';
import * as THREE from 'three';
import { toast } from 'sonner';

import Scene3D from '@/components/design-studio-3d/Scene3D';
import DesignCanvas2D, { DesignCanvas2DRef, DesignObject } from '@/components/design-studio-3d/DesignCanvas2D';
import ToolsPanel from '@/components/design-studio-3d/ToolsPanel';
import ShirtColorPicker from '@/components/design-studio-3d/ShirtColorPicker';
import ZoneSelector, { ShirtZone } from '@/components/design-studio-3d/ZoneSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

// T-shirt color options
const shirtColors = [
  { id: 'black', name: 'Obsidian Black', hex: '#1a1a1a' },
  { id: 'white', name: 'Pure White', hex: '#FFFFFF' },
  { id: 'navy', name: 'Midnight Navy', hex: '#1e3a5f' },
  { id: 'charcoal', name: 'Storm Charcoal', hex: '#36454f' },
  { id: 'olive', name: 'Military Olive', hex: '#556b2f' },
  { id: 'burgundy', name: 'Deep Burgundy', hex: '#722f37' },
];

const DesignStudio3D = () => {
  // Refs
  const canvasRef = useRef<DesignCanvas2DRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [shirtColor, setShirtColor] = useState(shirtColors[0].hex);
  const [activeZone, setActiveZone] = useState<ShirtZone>('front');
  const [designTexture, setDesignTexture] = useState<THREE.Texture | null>(null);
  const [activeColor, setActiveColor] = useState('#ffffff');
  const [selectedObject, setSelectedObject] = useState<DesignObject | null>(null);
  
  // Zone designs storage
  const [zoneDesigns, setZoneDesigns] = useState<Record<ShirtZone, DesignObject[]>>({
    front: [],
    back: [],
    leftSleeve: [],
    rightSleeve: [],
  });

  // History
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  // AI Generation
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Sync zone designs with canvas
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.setObjects(zoneDesigns[activeZone]);
    }
  }, [activeZone]);

  // Handle texture updates from canvas
  const handleTextureUpdate = useCallback((texture: THREE.Texture) => {
    setDesignTexture(texture);
  }, []);

  // Save current zone before switching
  const handleZoneChange = (newZone: ShirtZone) => {
    if (canvasRef.current) {
      const currentObjects = canvasRef.current.getObjects();
      setZoneDesigns(prev => ({
        ...prev,
        [activeZone]: currentObjects
      }));
    }
    setActiveZone(newZone);
    setSelectedObject(null);
  };

  // Check if zone has content
  const zoneHasContent = (zone: ShirtZone): boolean => {
    if (zone === activeZone && canvasRef.current) {
      return canvasRef.current.getObjects().length > 0;
    }
    return zoneDesigns[zone].length > 0;
  };

  // History management
  const saveHistory = () => {
    if (canvasRef.current) {
      const currentState = JSON.stringify(canvasRef.current.getObjects());
      const newHistory = history.slice(0, historyStep + 1);
      newHistory.push(currentState);
      setHistory(newHistory);
      setHistoryStep(newHistory.length - 1);
    }
  };

  const handleUndo = () => {
    if (historyStep > 0 && canvasRef.current) {
      const prevState = history[historyStep - 1];
      canvasRef.current.setObjects(JSON.parse(prevState));
      setHistoryStep(historyStep - 1);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1 && canvasRef.current) {
      const nextState = history[historyStep + 1];
      canvasRef.current.setObjects(JSON.parse(nextState));
      setHistoryStep(historyStep + 1);
    }
  };

  // Tool handlers
  const handleAddText = () => {
    canvasRef.current?.addText('YOUR TEXT', { fill: activeColor });
    saveHistory();
  };

  const handleAddShape = (shape: 'rect' | 'circle') => {
    canvasRef.current?.addShape(shape, { fill: activeColor });
    saveHistory();
  };

  const handleAddImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        canvasRef.current?.addImage(url);
        saveHistory();
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleDelete = () => {
    if (selectedObject) {
      canvasRef.current?.deleteObject(selectedObject.id);
      setSelectedObject(null);
      saveHistory();
    }
  };

  const handleDuplicate = () => {
    if (selectedObject && canvasRef.current) {
      const objects = canvasRef.current.getObjects();
      const newObj: DesignObject = {
        ...selectedObject,
        id: Date.now(),
        x: selectedObject.x + 20,
        y: selectedObject.y + 20
      };
      canvasRef.current.setObjects([...objects, newObj]);
      saveHistory();
    }
  };

  const handleBringToFront = () => {
    if (selectedObject && canvasRef.current) {
      const objects = canvasRef.current.getObjects();
      const filtered = objects.filter(o => o.id !== selectedObject.id);
      canvasRef.current.setObjects([...filtered, selectedObject]);
      saveHistory();
    }
  };

  const handleSendToBack = () => {
    if (selectedObject && canvasRef.current) {
      const objects = canvasRef.current.getObjects();
      const filtered = objects.filter(o => o.id !== selectedObject.id);
      canvasRef.current.setObjects([selectedObject, ...filtered]);
      saveHistory();
    }
  };

  const handleAlignCenter = () => {
    if (selectedObject && canvasRef.current) {
      canvasRef.current.updateObject(selectedObject.id, { x: 256 - 50 });
      saveHistory();
    }
  };

  const handleUpdateObject = (updates: Partial<DesignObject>) => {
    if (selectedObject && canvasRef.current) {
      canvasRef.current.updateObject(selectedObject.id, updates);
      // Apply color if fill is updated
      if (updates.fill) {
        setActiveColor(updates.fill);
      }
    }
  };

  const handleExport = () => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.exportPNG();
      const link = document.createElement('a');
      link.download = `alternate-design-${activeZone}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Design exported!');
    }
  };

  const handleSave = async () => {
    if (canvasRef.current) {
      // Save current zone
      const currentObjects = canvasRef.current.getObjects();
      const allZones = {
        ...zoneDesigns,
        [activeZone]: currentObjects
      };
      
      // For now, just show success - implement Supabase save later
      toast.success('Design saved!');
      console.log('Design data:', allZones);
    }
  };

  // AI Generation
  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Enter a design idea first');
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-design-image', {
        body: { prompt: aiPrompt }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        await canvasRef.current?.addImage(data.imageUrl);
        saveHistory();
        toast.success('AI design added to canvas!');
        setAiPrompt('');
      }
    } catch (err: any) {
      console.error('AI generation error:', err);
      toast.error(err.message || 'Failed to generate design');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Exit Studio</span>
          </Link>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-lg font-bold">
            <span className="text-foreground">ALTERNATE</span>
            <span className="text-primary ml-1">3D STUDIO</span>
          </h1>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
            PROFESSIONAL MOCKUP ENGINE
          </span>
        </div>

        {/* AI Generation in header */}
        <div className="flex items-center gap-2 max-w-md flex-1 mx-8">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
            <Input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Describe your design idea..."
              className="pl-10 pr-4 bg-muted/50 border-border"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateAI()}
            />
          </div>
          <Button 
            onClick={handleGenerateAI}
            disabled={isGenerating}
            size="sm"
            className="shrink-0"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: 2D Design Canvas */}
        <div className="w-80 border-r border-border bg-card/30 flex flex-col p-4 gap-4 shrink-0 overflow-y-auto">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Design Canvas</h3>
            <p className="text-xs text-muted-foreground">
              Create your design here. It updates the 3D preview in real-time.
            </p>
          </div>

          {/* Zone Selector */}
          <ZoneSelector
            activeZone={activeZone}
            onZoneChange={handleZoneChange}
            zoneHasContent={zoneHasContent}
          />

          {/* 2D Canvas */}
          <div className="flex justify-center">
            <DesignCanvas2D
              ref={canvasRef}
              width={512}
              height={512}
              onObjectSelect={setSelectedObject}
              onTextureUpdate={handleTextureUpdate}
            />
          </div>

          {/* Instructions */}
          <div className="text-xs text-muted-foreground space-y-1 bg-muted/30 p-3 rounded-lg">
            <p>• Click to select objects</p>
            <p>• Drag to move</p>
            <p>• Drop images to add</p>
            <p>• Use tools on the right panel</p>
          </div>
        </div>

        {/* Center: 3D Preview */}
        <div className="flex-1 relative overflow-hidden">
          <Scene3D
            shirtColor={shirtColor}
            designTexture={designTexture}
            zone={activeZone}
            autoRotate={false}
          />

          {/* Overlay Controls */}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between pointer-events-none">
            <div className="pointer-events-auto">
              <ShirtColorPicker
                colors={shirtColors}
                selectedColor={shirtColor}
                onColorChange={(color) => setShirtColor(color.hex)}
              />
            </div>

            <div className="bg-card/80 backdrop-blur-sm border border-border rounded-xl p-3 pointer-events-auto">
              <p className="text-xs text-muted-foreground">
                Drag to rotate • Scroll to zoom
              </p>
            </div>
          </div>

          {/* Loading overlay */}
          {isGenerating && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Generating your design with AI...</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Tools */}
        <ToolsPanel
          activeColor={activeColor}
          onColorChange={setActiveColor}
          onAddText={handleAddText}
          onAddShape={handleAddShape}
          onAddImage={handleAddImage}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
          onAlignCenter={handleAlignCenter}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onExport={handleExport}
          onSave={handleSave}
          selectedObject={selectedObject}
          onUpdateObject={handleUpdateObject}
          canUndo={historyStep > 0}
          canRedo={historyStep < history.length - 1}
        />
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
};

export default DesignStudio3D;
