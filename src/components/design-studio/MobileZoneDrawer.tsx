import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type ShirtZone = "front" | "back" | "left-sleeve" | "right-sleeve";

interface MobileZoneDrawerProps {
  activeZone: ShirtZone;
  onZoneChange: (zone: ShirtZone) => void;
}

const zones: { id: ShirtZone; label: string; description: string; icon: JSX.Element }[] = [
  {
    id: "front",
    label: "Front Center",
    description: "Main design area",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L8 6H5v14h14V6h-3l-4-4z" />
        <rect x="9" y="9" width="6" height="6" strokeDasharray="2 1" />
      </svg>
    ),
  },
  {
    id: "back",
    label: "Back Side",
    description: "Large print area",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L8 6H5v14h14V6h-3l-4-4z" />
        <rect x="8" y="8" width="8" height="10" strokeDasharray="2 1" />
      </svg>
    ),
  },
  {
    id: "left-sleeve",
    label: "Left Sleeve",
    description: "Small detail/logo",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 8L7 6v12l-4-2V8z" />
        <rect x="4" y="9" width="2" height="6" strokeDasharray="2 1" />
      </svg>
    ),
  },
  {
    id: "right-sleeve",
    label: "Right Sleeve",
    description: "Small detail/logo",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 8L17 6v12l4-2V8z" />
        <rect x="18" y="9" width="2" height="6" strokeDasharray="2 1" />
      </svg>
    ),
  },
];

const MobileZoneDrawer = ({ activeZone, onZoneChange }: MobileZoneDrawerProps) => {
  return (
    <div className="p-4 pt-2 space-y-4">
      {/* Handle for the drawer look */}
      <div className="w-12 h-1.5 bg-muted rounded-full mx-auto" />

      {/* Header */}
      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold">Select Design Area</h3>
        <p className="text-sm text-muted-foreground">Choose where you want to add your artwork</p>
      </div>

      {/* Zone Options */}
      <div className="space-y-2">
        {zones.map((zone) => {
          const isActive = activeZone === zone.id;
          return (
            <button
              key={zone.id}
              onClick={() => onZoneChange(zone.id)}
              className={cn(
                "flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 border-2 w-full text-left",
                isActive 
                  ? "bg-primary/10 border-primary shadow-[0_0_15px_hsl(var(--primary)/0.1)]" 
                  : "bg-zinc-900/50 border-transparent hover:border-zinc-700"
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                {zone.icon}
              </div>
              
              <div className="flex-1">
                <span className={cn(
                  "font-medium block",
                  isActive ? "text-primary" : "text-foreground"
                )}>
                  {zone.label}
                </span>
                <span className="text-sm text-muted-foreground">{zone.description}</span>
              </div>

              {isActive && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileZoneDrawer;
