import { cn } from '@/lib/utils';

export type ShirtZone = 'front' | 'back' | 'leftSleeve' | 'rightSleeve';

interface ZoneSelectorProps {
  activeZone: ShirtZone;
  onZoneChange: (zone: ShirtZone) => void;
  zoneHasContent: (zone: ShirtZone) => boolean;
}

const zones: { id: ShirtZone; label: string; shortLabel: string }[] = [
  { id: 'front', label: 'Front', shortLabel: 'F' },
  { id: 'back', label: 'Back', shortLabel: 'B' },
  { id: 'leftSleeve', label: 'Left Sleeve', shortLabel: 'L' },
  { id: 'rightSleeve', label: 'Right Sleeve', shortLabel: 'R' },
];

const ZoneSelector = ({ activeZone, onZoneChange, zoneHasContent }: ZoneSelectorProps) => {
  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border rounded-xl p-4 space-y-3">
      <span className="text-sm font-medium text-foreground">Print Zone</span>
      
      <div className="flex gap-2">
        {zones.map((zone) => {
          const hasContent = zoneHasContent(zone.id);
          const isActive = activeZone === zone.id;
          
          return (
            <button
              key={zone.id}
              onClick={() => onZoneChange(zone.id)}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all relative",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="hidden sm:inline">{zone.label}</span>
              <span className="sm:hidden">{zone.shortLabel}</span>
              
              {/* Content indicator */}
              {hasContent && (
                <span 
                  className={cn(
                    "absolute -top-1 -right-1 w-2 h-2 rounded-full",
                    isActive ? "bg-primary-foreground" : "bg-primary"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ZoneSelector;
