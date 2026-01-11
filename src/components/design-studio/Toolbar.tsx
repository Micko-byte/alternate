import { MousePointer2, Pencil, Type, Square, Circle, Undo2, Redo2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type Tool = "select" | "draw" | "text" | "rect" | "circle";

interface ToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

const tools = [
  { id: "select" as Tool, icon: MousePointer2, label: "Select" },
  { id: "draw" as Tool, icon: Pencil, label: "Draw" },
  { id: "text" as Tool, icon: Type, label: "Text" },
  { id: "rect" as Tool, icon: Square, label: "Rectangle" },
  { id: "circle" as Tool, icon: Circle, label: "Circle" },
];

const Toolbar = ({ activeTool, onToolChange, onUndo, onRedo, onClear }: ToolbarProps) => {
  return (
    <div className="flex flex-col gap-2 p-2 bg-card border border-border rounded-lg">
      {/* Tool Selection */}
      <div className="flex flex-col gap-1">
        {tools.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === tool.id ? "default" : "ghost"}
                size="icon"
                onClick={() => onToolChange(tool.id)}
                className={`w-10 h-10 ${
                  activeTool === tool.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                }`}
              >
                <tool.icon className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{tool.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <div className="h-px bg-border my-2" />

      {/* History Actions */}
      <div className="flex flex-col gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onUndo} className="w-10 h-10">
              <Undo2 className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Undo</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onRedo} className="w-10 h-10">
              <Redo2 className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Redo</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClear}
              className="w-10 h-10 hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Clear Canvas</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default Toolbar;
