import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Save, Type, Images, LayoutTemplate, Shirt, ShoppingBag, Sparkles, FolderOpen, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import DesignCanvas, { DesignCanvasRef } from "@/components/design-studio/DesignCanvas";
import Toolbar from "@/components/design-studio/Toolbar";
import ColorPicker from "@/components/design-studio/ColorPicker";
import TextPanel from "@/components/design-studio/TextPanel";
import AssetsPanel from "@/components/design-studio/AssetsPanel";
import TemplatesPanel from "@/components/design-studio/TemplatesPanel";
import MockupPreview from "@/components/design-studio/MockupPreview";
import ExportPanel from "@/components/design-studio/ExportPanel";
import AIGeneratePanel from "@/components/design-studio/AIGeneratePanel";
import SavedDesignsPanel from "@/components/design-studio/SavedDesignsPanel";
import MobileMoneyCheckout from "@/components/MobileMoneyCheckout";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

type Tool = "select" | "draw" | "text" | "rectangle" | "circle";

const DesignStudio = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [activeColor, setActiveColor] = useState("#84cc16");
  const [canvasRef, setCanvasRef] = useState<DesignCanvasRef | null>(null);
  const [activePanel, setActivePanel] = useState("ai");
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedSize, setSelectedSize] = useState("m");

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
  };

  const handleCanvasReady = useCallback((ref: DesignCanvasRef) => {
    setCanvasRef(ref);
  }, []);

  const handleToolChange = (tool: Tool) => {
    setActiveTool(tool);
    if (tool === "rectangle" || tool === "circle") {
      canvasRef?.addShape(tool);
      setActiveTool("select");
    }
  };

  const handleUndo = () => canvasRef?.undo();
  const handleRedo = () => canvasRef?.redo();
  const handleClear = () => {
    canvasRef?.clear();
    toast.success("Canvas cleared!");
  };

  const handleSave = () => {
    toast.success("Design saved locally!", {
      description: "Sign in to save to your account",
    });
  };

  const handleOrder = (size: string) => {
    setSelectedSize(size);
    setShowCheckout(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Back</span>
          </Link>
          <div className="h-6 w-px bg-border" />
          <span className="font-display text-xl tracking-wider">DESIGN STUDIO</span>
        </div>

        <div className="flex items-center gap-2">
          <ColorPicker color={activeColor} onChange={setActiveColor} />
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {user.email?.split('@')[0]}
              </span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
              <User className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Sign In</span>
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Tools */}
        <aside className="w-16 border-r border-border bg-card p-2 flex-shrink-0 hidden md:block">
          <Toolbar
            activeTool={activeTool}
            onToolChange={handleToolChange}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClear}
          />
        </aside>

        {/* Left Panel - Options (Desktop) */}
        <aside className="w-72 border-r border-border bg-card p-4 overflow-y-auto hidden lg:block">
          <Tabs value={activePanel} onValueChange={setActivePanel}>
            <TabsList className="w-full grid grid-cols-5 mb-4">
              <TabsTrigger value="ai" className="text-xs p-1">
                <Sparkles className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="saved" className="text-xs p-1">
                <FolderOpen className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="text" className="text-xs p-1">
                <Type className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="assets" className="text-xs p-1">
                <Images className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="templates" className="text-xs p-1">
                <LayoutTemplate className="w-3 h-3" />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="mt-0">
              <AIGeneratePanel canvasRef={canvasRef} />
            </TabsContent>
            <TabsContent value="saved" className="mt-0">
              <SavedDesignsPanel canvasRef={canvasRef} />
            </TabsContent>
            <TabsContent value="text" className="mt-0">
              <TextPanel canvasRef={canvasRef} activeColor={activeColor} />
            </TabsContent>
            <TabsContent value="assets" className="mt-0">
              <AssetsPanel canvasRef={canvasRef} activeColor={activeColor} />
            </TabsContent>
            <TabsContent value="templates" className="mt-0">
              <TemplatesPanel canvasRef={canvasRef} />
            </TabsContent>
          </Tabs>
        </aside>

        {/* Canvas Area */}
        <main className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-auto bg-muted/30">
          <DesignCanvas
            activeColor={activeColor}
            activeTool={activeTool}
            onCanvasReady={handleCanvasReady}
          />
        </main>

        {/* Right Panel - Preview & Export (Desktop) */}
        <aside className="w-72 border-l border-border bg-card p-4 overflow-y-auto hidden xl:block">
          <Tabs defaultValue="preview">
            <TabsList className="w-full grid grid-cols-2 mb-4">
              <TabsTrigger value="preview" className="text-xs">
                <Shirt className="w-3 h-3 mr-1" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="order" className="text-xs">
                <ShoppingBag className="w-3 h-3 mr-1" />
                Order
              </TabsTrigger>
            </TabsList>

            <TabsContent value="preview" className="mt-0">
              <MockupPreview canvasRef={canvasRef} />
            </TabsContent>
            <TabsContent value="order" className="mt-0">
              <ExportPanel canvasRef={canvasRef} onOrder={handleOrder} />
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      {/* Mobile Bottom Bar */}
      <div className="md:hidden border-t border-border bg-card p-2 flex items-center justify-around">
        {/* Mobile Toolbar */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm">
              <Type className="w-4 h-4 mr-1" />
              Tools
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[70vh]">
            <Tabs defaultValue="text" className="mt-4">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="assets">Assets</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="mt-4">
                <TextPanel canvasRef={canvasRef} activeColor={activeColor} />
              </TabsContent>
              <TabsContent value="assets" className="mt-4">
                <AssetsPanel canvasRef={canvasRef} activeColor={activeColor} />
              </TabsContent>
              <TabsContent value="templates" className="mt-4">
                <TemplatesPanel canvasRef={canvasRef} />
              </TabsContent>
            </Tabs>
          </SheetContent>
        </Sheet>

        <ColorPicker color={activeColor} onChange={setActiveColor} />

        {/* Mobile Preview/Order */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="default" size="sm">
              <ShoppingBag className="w-4 h-4 mr-1" />
              Order
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[70vh]">
            <div className="mt-4 space-y-6">
              <MockupPreview canvasRef={canvasRef} />
              <ExportPanel canvasRef={canvasRef} onOrder={handleOrder} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
            <h2 className="font-display text-xl mb-4">Complete Your Order</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Custom Design • Size {selectedSize.toUpperCase()} • UGX 60,000
            </p>
            <MobileMoneyCheckout
              productName="Custom Design Tee"
              price="UGX 60,000"
              size={selectedSize.toUpperCase()}
            />
            <Button
              variant="ghost"
              className="w-full mt-4"
              onClick={() => setShowCheckout(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignStudio;
