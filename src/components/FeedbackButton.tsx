import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquare, Star, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn, errorMessage } from "@/lib/utils";
import { Button, Textarea } from "@/components/ui";

export const FEEDBACK_CATEGORIES = [
  { value: "tryon_quality", label: "Try-on quality" },
  { value: "idea", label: "Idea" },
  { value: "bug", label: "Something broke" },
  { value: "stores", label: "Stores & clothes" },
  { value: "payments", label: "Credits & M-Pesa" },
  { value: "other", label: "Other" },
] as const;

/** Lets clients tell us how to improve. `tryonId` links feedback to a specific try-on. */
export function FeedbackButton({ tryonId, variant = "icon", label = "Feedback" }: { tryonId?: string; variant?: "icon" | "link" | "button"; label?: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>(tryonId ? "tryon_quality" : "idea");
  const [rating, setRating] = useState<number>(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const location = useLocation();

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  const send = async () => {
    setBusy(true);
    const { error } = await supabase.from("feedback").insert({
      category: category as never,
      rating: rating || null,
      message: message.trim(),
      page: location.pathname.slice(0, 200),
      tryon_id: tryonId ?? null,
    });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Thank you. The VAA ALTERNATE team reads every message.");
    setMessage("");
    setRating(0);
    setOpen(false);
  };

  return (
    <>
      {variant === "icon" ? (
        <button onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center hover:bg-sunk" aria-label="Send feedback" title="Send feedback">
          <MessageSquare className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </button>
      ) : variant === "link" ? (
        <button onClick={() => setOpen(true)} className="label text-ink underline underline-offset-4">{label}</button>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}><MessageSquare className="h-4 w-4" /> {label}</Button>
      )}

      <dialog ref={dialog} onClose={() => setOpen(false)} className="w-[min(560px,calc(100vw-2rem))] border border-ink bg-paper p-0 text-ink backdrop:bg-black/55">
        <form method="dialog" onSubmit={(e) => { e.preventDefault(); if (message.trim().length >= 3) send(); }} className="grid gap-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <span className="label">Feedback</span>
              <h2 className="display text-[34px]">Help us improve</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center hover:bg-sunk" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>

          <fieldset className="grid gap-2">
            <legend className="label mb-2">About</legend>
            <div className="flex flex-wrap gap-1.5">
              {FEEDBACK_CATEGORIES.map((c) => (
                <button type="button" key={c.value} onClick={() => setCategory(c.value)} aria-pressed={category === c.value} className={cn("h-9 border px-3 font-mono text-[11px] font-semibold uppercase tracking-label", category === c.value ? "border-ink bg-ink text-paper" : "border-rule text-muted hover:border-ink hover:text-ink")}>
                  {c.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="label mb-2">How would you rate VAA ALTERNATE so far?</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n} onClick={() => setRating(n === rating ? 0 : n)} aria-label={`${n} of 5`} aria-pressed={rating >= n} className="p-1">
                  <Star className={cn("h-7 w-7", n <= rating ? "fill-mustard text-mustard" : "text-grey")} strokeWidth={1.4} />
                </button>
              ))}
            </div>
          </fieldset>

          <Textarea required minLength={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What worked, what didn't, what should we add?" className="min-h-[120px]" />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={busy} disabled={message.trim().length < 3}>Send</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
