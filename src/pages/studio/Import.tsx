import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractVideoFrame } from "@/lib/media";
import { cn, errorMessage, extensionOf } from "@/lib/utils";
import { Button, ButtonLink, Notice, PageHeader, Textarea } from "@/components/ui";
import { useStore } from "./types";

const MAX_ITEMS = 30;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

type Step = "ready" | "uploading" | "writing" | "done" | "failed";
type Item = { key: string; file: File; kind: "image" | "video"; preview?: string; frame?: Blob; caption: string; step: Step; error?: string };

export default function Import() {
  const store = useStore();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);

  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const addFiles = async (files: FileList | File[]) => {
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    const room = MAX_ITEMS - items.length;
    if (picked.length > room) toast.error(`You can import up to ${MAX_ITEMS} pieces at a time.`);
    for (const file of picked.slice(0, Math.max(0, room))) {
      const kind = file.type.startsWith("video/") ? "video" : "image";
      if (kind === "video" && file.size > MAX_VIDEO_BYTES) {
        toast.error(`${file.name} is over 50 MB. Trim it and try again.`);
        continue;
      }
      const key = crypto.randomUUID();
      const item: Item = { key, file, kind, caption: "", step: "ready", preview: kind === "image" ? URL.createObjectURL(file) : undefined };
      setItems((list) => [...list, item]);
      if (kind === "video") {
        extractVideoFrame(file)
          .then((frame) => update(key, { frame, preview: URL.createObjectURL(frame) }))
          .catch(() => update(key, { error: "Couldn't read this video" }));
      }
    }
  };

  const copyCaptionToAll = (caption: string) => setItems((list) => list.map((i) => (i.step === "ready" ? { ...i, caption } : i)));

  const importOne = async (item: Item) => {
    update(item.key, { step: "uploading", error: undefined });
    const { data: product, error } = await supabase
      .from("products")
      .insert({
        store_id: store.id,
        name: "Importing…",
        category: "other",
        price_kes: 0,
        status: "draft",
        needs_review: true,
        import_source: "bulk",
        source_caption: item.caption.trim() || null,
      })
      .select("id")
      .single();
    if (error) throw error;

    const upload = async (blob: Blob, kind: "image" | "video", ext: string, extra: { is_tryon_source: boolean; extracted_from?: string }) => {
      const id = crypto.randomUUID();
      const path = `${store.id}/products/${product.id}/${id}.${ext}`;
      const { error: upErr } = await supabase.storage.from("store-media").upload(path, blob, { contentType: blob.type || (kind === "image" ? "image/jpeg" : "video/mp4") });
      if (upErr) throw upErr;
      const { error: rowErr } = await supabase.from("product_media").insert({ id, product_id: product.id, store_id: store.id, kind, storage_path: path, position: kind === "video" ? 1 : 0, ...extra });
      if (rowErr) throw rowErr;
      return id;
    };

    if (item.kind === "video") {
      const videoId = await upload(item.file, "video", extensionOf(item.file), { is_tryon_source: false });
      const frame = item.frame ?? (await extractVideoFrame(item.file));
      await upload(frame, "image", "jpg", { is_tryon_source: true, extracted_from: videoId });
    } else {
      await upload(item.file, "image", extensionOf(item.file), { is_tryon_source: true });
    }

    update(item.key, { step: "writing" });
    const { error: aiError } = await supabase.functions.invoke("draft-product", { body: { product_id: product.id } });
    if (aiError) {
      let message = errorMessage(aiError);
      try {
        const body = await (aiError as { context?: Response }).context?.json();
        if (body?.error) message = body.error;
      } catch {
        /* keep generic message */
      }
      update(item.key, { step: "failed", error: `Saved, but the AI draft failed: ${message}. You can fill it in when reviewing.` });
      return;
    }
    update(item.key, { step: "done" });
  };

  const run = async () => {
    setRunning(true);
    const queue = items.filter((i) => i.step === "ready" || i.step === "failed");
    // Two at a time: quick on good connections, gentle on mobile data
    let next = 0;
    const worker = async () => {
      while (next < queue.length) {
        const item = queue[next++];
        try {
          await importOne(item);
        } catch (err) {
          update(item.key, { step: "failed", error: errorMessage(err) });
        }
      }
    };
    await Promise.all([worker(), worker()]);
    setRunning(false);
    queryClient.invalidateQueries({ queryKey: ["studio-products"] });
    queryClient.invalidateQueries({ queryKey: ["review-count"] });
    queryClient.invalidateQueries({ queryKey: ["review-queue"] });
    toast.success("Drafts ready to review");
  };

  const done = items.filter((i) => i.step === "done" || (i.step === "failed" && i.error?.startsWith("Saved"))).length;
  const pending = items.filter((i) => i.step === "ready").length;

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Import" title="Add your rail in one go">
        {done > 0 && !running && <ButtonLink to="/studio/review" variant="solid">Review {done} {done === 1 ? "piece" : "pieces"}</ButtonLink>}
      </PageHeader>

      <p className="max-w-[62ch] text-muted">
        Choose photos or videos of your clothes, one piece per photo. Paste the caption you used on Instagram, TikTok or WhatsApp under each one. We'll write the name, type, price and sizes, and you check them before anything goes live.
      </p>

      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
        className={cn("grid cursor-pointer place-items-center gap-3 border border-dashed px-6 py-12 text-center", over ? "border-ink bg-sunk" : "border-ink/35 hover:border-ink", running && "pointer-events-none opacity-50")}
      >
        <input type="file" multiple accept="image/*,video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        <ImagePlus className="h-8 w-8" strokeWidth={1.4} aria-hidden />
        <span className="display text-[34px]">Choose photos & videos</span>
        <span className="text-[14px] text-muted">Up to {MAX_ITEMS} at a time · videos under 50 MB · or drag them here</span>
      </label>

      {items.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => (
              <div key={item.key} className="grid gap-3 border border-rule bg-surface p-3">
                <div className="relative aspect-[3/4] overflow-hidden bg-sunk">
                  {item.preview ? <img src={item.preview} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center label">Reading video…</span>}
                  {item.kind === "video" && <span className="absolute left-2 top-2 bg-paper/90 px-2 py-1 font-mono text-[10px] uppercase">Video · frame used for try-on</span>}
                  <StepBadge step={item.step} />
                  {item.step === "ready" && !running && (
                    <button onClick={() => setItems((l) => l.filter((i) => i.key !== item.key))} className="absolute right-2 top-2 grid h-8 w-8 place-items-center bg-paper/90 hover:bg-paper" aria-label="Remove">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Textarea
                  value={item.caption}
                  onChange={(e) => update(item.key, { caption: e.target.value })}
                  disabled={item.step !== "ready" && item.step !== "failed"}
                  placeholder={'Paste the caption, e.g. "Wide leg trousers 🔥 2,500/= sizes 30–36"'}
                  className="min-h-[84px] text-[14px]"
                  maxLength={2200}
                />
                {index === 0 && items.length > 1 && item.caption && item.step === "ready" && (
                  <button onClick={() => copyCaptionToAll(item.caption)} className="label justify-self-start text-ink underline underline-offset-4">Use this caption for all</button>
                )}
                {item.error && <p className={cn("text-[13px]", item.error.startsWith("Saved") ? "text-warn" : "text-bad")}>{item.error}</p>}
              </div>
            ))}
          </div>

          <div className="sticky bottom-20 flex flex-wrap items-center justify-between gap-3 border border-ink bg-paper p-4 md:bottom-4">
            <span className="text-[14px] text-muted">
              {running ? "Uploading and writing drafts… keep this page open." : pending > 0 ? `${pending} ready to import. About KES 3 each for the AI draft.` : "All imported."}
            </span>
            <Button variant="solid" size="lg" onClick={run} loading={running} disabled={running || items.every((i) => i.step === "done")}>
              Create {items.filter((i) => i.step === "ready" || i.step === "failed").length} drafts
            </Button>
          </div>
        </>
      )}

      {items.length === 0 && (
        <Notice title="Selling from a stall with no page?">
          Take a photo of each piece on its hanger, pick them all here, and type the price and size in the caption box, e.g. "1500 size M".
        </Notice>
      )}
    </div>
  );
}

function StepBadge({ step }: { step: Step }) {
  if (step === "ready") return null;
  const map: Record<Exclude<Step, "ready">, { text: string; cls: string; icon?: boolean }> = {
    uploading: { text: "Uploading", cls: "bg-paper text-ink", icon: true },
    writing: { text: "Writing listing", cls: "bg-paper text-ink", icon: true },
    done: { text: "Draft ready", cls: "bg-good text-white" },
    failed: { text: "Needs attention", cls: "bg-warn text-white" },
  };
  const s = map[step];
  return (
    <span className={cn("absolute inset-x-2 bottom-2 flex items-center justify-center gap-2 py-2 font-mono text-[11px] font-semibold uppercase tracking-label", s.cls)}>
      {s.icon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : step === "done" ? <Check className="h-3.5 w-3.5" /> : null}
      {s.text}
    </span>
  );
}
