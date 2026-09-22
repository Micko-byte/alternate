import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Our own room for the model: an ink floor, an electric rim behind the shoulders and the globe
 * turning slowly under the feet. The model is lit by the same accent, so a dress reads as fabric
 * rather than as a screenshot of somebody's 3D software.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & Record<string, unknown>;
    }
  }
}

let loading: Promise<unknown> | null = null;
function loadViewer() {
  if (!loading) {
    loading = import("@google/model-viewer");
  }
  return loading;
}

export function SpinStage({ url, label, className }: { url: string; label?: string; className?: string }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const viewer = useRef<HTMLElement>(null);

  useEffect(() => {
    loadViewer().then(() => setReady(true)).catch(() => setFailed(true));
  }, []);

  if (failed) {
    return <p className="border border-rule bg-sunk p-4 text-[14px] text-muted">The 3D view didn't load. Reload the page and it usually comes back.</p>;
  }

  return (
    <div className={className}>
      <div className="relative isolate overflow-hidden border border-ink bg-[#0F0E0C]">
        {/* the room */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[6%] h-[62%] w-[78%] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(93,124,255,0.42),rgba(93,124,255,0)_62%)] blur-2xl" />
          <div className="absolute left-1/2 top-[44%] h-[34%] w-[52%] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(232,184,74,0.3),rgba(232,184,74,0)_66%)] blur-2xl" />
          <div className="absolute inset-x-0 bottom-0 h-[34%] bg-[linear-gradient(to_top,rgba(0,0,0,0.85),rgba(0,0,0,0))]" />
          <div className="absolute inset-x-0 bottom-[18%] h-px bg-[linear-gradient(to_right,transparent,rgba(243,241,236,0.35),transparent)]" />
          <img src="/brand/vaa-mark-white.png" alt="" className="absolute bottom-4 left-4 h-6 w-auto opacity-55" />
          {label && (
            <span className="absolute right-4 top-4 bg-ink/70 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-label text-paper">
              {label}
            </span>
          )}
        </div>

        {ready ? (
          <model-viewer
            ref={viewer}
            src={url}
            alt="Your try-on as a 3D model you can turn"
            camera-controls
            touch-action="pan-y"
            auto-rotate
            auto-rotate-delay={600}
            rotation-per-second="18deg"
            interaction-prompt="none"
            shadow-intensity="1.4"
            shadow-softness="0.9"
            exposure="1.05"
            environment-image="neutral"
            camera-orbit="0deg 82deg 2.4m"
            min-camera-orbit="auto 55deg auto"
            max-camera-orbit="auto 100deg auto"
            style={{ width: "100%", height: "min(74vh, 620px)", background: "transparent", "--progress-bar-color": "#E8B84A" } as React.CSSProperties}
          />
        ) : (
          <div className="grid h-[min(74vh,620px)] place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-paper/70" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
        <p className="text-[13px] text-muted">Drag to turn. Pinch to zoom.</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const el = viewer.current as (HTMLElement & { cameraOrbit?: string; resetTurntableRotation?: () => void }) | null;
            el?.resetTurntableRotation?.();
            if (el) el.cameraOrbit = "0deg 82deg 2.4m";
          }}
        >
          <RotateCcw className="h-4 w-4" /> Face front
        </Button>
      </div>
    </div>
  );
}
