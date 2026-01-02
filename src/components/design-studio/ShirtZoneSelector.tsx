import { cn } from "@/lib/utils";

export type ShirtZone = "front" | "back" | "left-sleeve" | "right-sleeve";

interface ShirtZoneSelectorProps {
  activeZone: ShirtZone;
  onZoneChange: (zone: ShirtZone) => void;
}

const zones: { id: ShirtZone; label: string; icon: JSX.Element }[] = [
  {
    id: "front",
    label: "FRONT",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L8 6H5v14h14V6h-3l-4-4z" />
      </svg>
    ),
  },
  {
    id: "back",
    label: "BACK",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L8 6H5v14h14V6h-3l-4-4z" />
        <rect x="8" y="8" width="8" height="10" strokeDasharray="2 1" />
      </svg>
    ),
  },
  {
    id: "left-sleeve",
    label: "L-SLEEVE",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 8L7 6v12l-4-2V8z" />
        <rect x="4" y="9" width="2" height="6" strokeDasharray="2 1" />
      </svg>
    ),
  },
  {
    id: "right-sleeve",
    label: "R-SLEEVE",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 8L17 6v12l4-2V8z" />
        <rect x="18" y="9" width="2" height="6" strokeDasharray="2 1" />
      </svg>
    ),
  },
];

const ShirtZoneSelector = ({ activeZone, onZoneChange }: ShirtZoneSelectorProps) => {
  return (
    <div className="rounded-xl bg-zinc-950 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          Design Area
        </span>
        <span className="text-xs text-primary font-semibold">
          {zones.find(z => z.id === activeZone)?.label}
        </span>
      </div>

      {/* Segmented Control Container */}
      <div className="flex gap-1 p-1 bg-zinc-900/50 rounded-lg">
        {zones.map((zone) => {
          const isActive = activeZone === zone.id;
          return (
            <button
              key={zone.id}
              onClick={() => onZoneChange(zone.id)}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1.5 py-2.5 transition-all duration-200 rounded-lg",
                isActive 
                  ? "bg-zinc-800 text-primary shadow-sm shadow-black/50" 
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <div className="w-5 h-5">
                {zone.icon}
              </div>
              <span className="text-[10px] font-medium tracking-wider">
                {zone.label}
              </span>
              
              {/* Active Indicator Underline */}
              {isActive && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ShirtZoneSelector;
