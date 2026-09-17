import { useEffect, useRef, useState, type ReactNode } from "react";
import { Box, RotateCw, Ruler, X } from "lucide-react";
import { Button } from "@/components/ui";

/** 3D body view: announced, not built yet. */
export function ComingSoon3D({ trigger }: { trigger: (open: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  return (
    <>
      {trigger(() => setOpen(true))}
      <dialog ref={dialog} onClose={() => setOpen(false)} className="w-[min(520px,calc(100vw-2rem))] border border-ink bg-paper p-0 text-ink backdrop:bg-black/55">
        <div className="grid gap-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-2">
              <span className="w-fit bg-mustard px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-label text-ink">Coming soon</span>
              <h2 className="display text-[34px]">See it on you in 3D</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center hover:bg-sunk" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid aspect-[4/3] place-items-center border border-dashed border-rule bg-sunk">
            <Box className="h-16 w-16 text-muted" strokeWidth={1} />
          </div>
          <ul className="grid gap-2 text-[14.5px] text-muted">
            <li className="flex gap-2"><RotateCw className="mt-0.5 h-4 w-4 shrink-0 text-ink" /> Turn around in the outfit and see the back and sides.</li>
            <li className="flex gap-2"><Ruler className="mt-0.5 h-4 w-4 shrink-0 text-ink" /> A body model built from your photos and measurements, so the fit shows from every angle.</li>
          </ul>
          <Button variant="solid" onClick={() => setOpen(false)}>Got it</Button>
        </div>
      </dialog>
    </>
  );
}
