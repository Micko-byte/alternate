import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { errorMessage } from "@/lib/utils";

/**
 * Permanent deletion with a clear warning and a chance to download first.
 * The trigger renders whatever is passed as `children` (a button), and the dialog confirms.
 */
export function DeleteForever({ title, body, onDelete, onDownload, trigger }: {
  title: string;
  body: ReactNode;
  onDelete: () => Promise<void>;
  onDownload?: () => void | Promise<void>;
  trigger: (open: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  return (
    <>
      {trigger(() => setOpen(true))}
      <dialog ref={dialog} onClose={() => setOpen(false)} className="w-[min(480px,calc(100vw-2rem))] border border-ink bg-paper p-0 text-ink backdrop:bg-black/55">
        <div className="grid gap-5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-bad" />
            <div className="grid gap-2">
              <h2 className="display text-[28px]">{title}</h2>
              <div className="text-[14.5px] text-muted">{body}</div>
              <p className="font-medium text-bad">This is permanent. Once deleted it is gone from our servers and never coming back.</p>
            </div>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            {onDownload && (
              <Button variant="outline" onClick={() => onDownload()}>
                <Download className="h-4 w-4" /> Download first
              </Button>
            )}
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete();
                  setOpen(false);
                } catch (err) {
                  toast.error(errorMessage(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete forever
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>Keep it</Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
