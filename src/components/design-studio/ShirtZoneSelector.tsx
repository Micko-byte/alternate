import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ShirtZone = "front" | "back" | "left-sleeve" | "right-sleeve";

interface ShirtZoneSelectorProps {
  activeZone: ShirtZone;
  onZoneChange: (zone: ShirtZone) => void;
}

const zones: { id: ShirtZone; label: string; icon: JSX.Element }[] = [
  {
    id: "front",
    label: "Front",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L8 6H5v14h14V6h-3l-4-4z" />
        <rect x="9" y="9" width="6" height="6" strokeDasharray="2 1" />
      </svg>
    ),
  },
  {
    id: "back",
    label: "Back",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L8 6H5v14h14V6h-3l-4-4z" />
        <rect x="8" y="8" width="8" height="10" strokeDasharray="2 1" />
      </svg>
    ),
  },
  {
    id: "left-sleeve",
    label: "L.Sleeve",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 8L7 6v12l-4-2V8z" />
        <rect x="4" y="9" width="2" height="6" strokeDasharray="2 1" />
      </svg>
    ),
  },
  {
    id: "right-sleeve",
    label: "R.Sleeve",
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
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground font-medium">Design Area</span>
      <div className="grid grid-cols-4 gap-1">
        {zones.map((zone) => (
          <Button
            key={zone.id}
            variant={activeZone === zone.id ? "default" : "outline"}
            size="sm"
            onClick={() => onZoneChange(zone.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 h-auto py-2 px-1",
              activeZone === zone.id && "bg-primary text-primary-foreground"
            )}
          >
            {zone.icon}
            <span className="text-[10px]">{zone.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default ShirtZoneSelector;
