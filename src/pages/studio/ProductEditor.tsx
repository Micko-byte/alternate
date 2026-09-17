import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_SINGULAR, cn, errorMessage, extensionOf, publicMediaUrl } from "@/lib/utils";
import { DEPARTMENTS, SIZE_SYSTEMS, type Department, type SizeSystem } from "@/lib/sizes";
import { Button, Field, Input, Notice, PageHeader, Pill, Select, Spinner, Textarea } from "@/components/ui";
import { VideoFramePicker } from "@/components/VideoFramePicker";
import { LengthInput, LengthUnitToggle } from "@/components/UnitInputs";
import { useStore } from "./types";
import { GARMENT_BY_CATEGORY, LENGTH_OPTIONS } from "@/lib/garments";
import { MEASURES_FOR, MEASURE_LABELS, STRETCH_OPTIONS, convertAround, toMeasurements, type MeasureKey } from "@/lib/garmentFit";

type VariantDraft = { id?: string; size_label: string; size_min: string; size_max: string; stock_qty: string; m: Partial<Record<MeasureKey, string>> };

export default function ProductEditor() {
  const { id } = useParams();
  return id === "new" ? <NewProduct /> : <EditProduct id={id!} />;
}

function NewProduct() {
  const store = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("dress");
  const [department, setDepartment] = useState<Department>("women");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from("products")
      .insert({ store_id: store.id, name: name.trim(), category: category as never, department, price_kes: Number(price) })
      .select("id")
      .single();
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    navigate(`/studio/products/${data.id}`, { replace: true });
  };

  return (
    <div className="grid max-w-xl gap-8">
      <PageHeader eyebrow="New piece" title="Add to your rail" />
      <form className="grid gap-4 border border-rule bg-surface p-6" onSubmit={(e) => { e.preventDefault(); create(); }}>
        <Field label="Name"><Input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ankara wrap midi" /></Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Section">
            <Select value={department} onChange={(e) => setDepartment(e.target.value as Department)}>
              {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </Select>
          </Field>
          <Field label="Type">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(CATEGORY_SINGULAR).map(([k, v]) => <option key={k} value={k}>{v[0].toUpperCase() + v.slice(1)}</option>)}
            </Select>
          </Field>
          <Field label="Price (KES)"><Input required type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="num" /></Field>
        </div>
        <Button type="submit" variant="accent" loading={busy}>Continue to photos and sizes</Button>
      </form>
    </div>
  );
}

function EditProduct({ id }: { id: string }) {
  const store = useStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const fromReview = params.get("from") === "review";

  const product = useQuery({
    queryKey: ["studio-product", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*, product_media(*), product_variants(*)").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [measuredFlat, setMeasuredFlat] = useState(false);
  const [form, setForm] = useState({ name: "", category: "dress", garmentType: "", length: "", lengthCm: "", stretch: "", department: "women" as Department, sizeSystem: "uk_women" as SizeSystem, price_kes: "", description: "", status: "draft", is_one_of_a_kind: false });
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingVideo, setPendingVideo] = useState<File>();

  useEffect(() => {
    const p = product.data;
    if (!p) return;
    setForm({
      name: p.name,
      category: p.category,
      garmentType: p.garment_type ?? "",
      length: p.length ?? "",
      lengthCm: p.length_cm != null ? String(p.length_cm) : "",
      stretch: p.stretch ?? "",
      department: p.department,
      sizeSystem: p.product_variants[0]?.size_system ?? (p.department === "men" ? (p.category === "bottom" ? "waist_in" : "letter") : "uk_women"),
      price_kes: String(p.price_kes),
      description: p.description ?? "",
      status: p.status,
      is_one_of_a_kind: p.is_one_of_a_kind,
    });
    setVariants(
      [...p.product_variants]
        .sort((a, b) => (a.size_min ?? 0) - (b.size_min ?? 0))
        .map((v) => ({
          id: v.id,
          size_label: v.size_label,
          size_min: v.size_min?.toString() ?? "",
          size_max: v.size_max?.toString() ?? "",
          stock_qty: String(v.stock_qty),
          m: Object.fromEntries(Object.entries((v.measurements ?? {}) as Record<string, number>).map(([k, n]) => [k, String(n)])),
        })),
    );
    setRemoved([]);
  }, [product.data]);

  if (product.isLoading) return <div className="grid place-items-center py-24"><Spinner /></div>;
  if (!product.data) return <Notice title="Piece not found" />;

  const media = [...product.data.product_media].sort((a, b) => a.position - b.position);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["studio-product", id] });
    queryClient.invalidateQueries({ queryKey: ["studio-products"] });
  };

  const uploadMedia = async (file: Blob, kind: "image" | "video", ext: string, extra: { is_tryon_source?: boolean; extracted_from?: string } = {}) => {
    const mediaId = crypto.randomUUID();
    const path = `${store.id}/products/${id}/${mediaId}.${ext}`;
    const { error: upErr } = await supabase.storage.from("store-media").upload(path, file, { contentType: file.type });
    if (upErr) throw upErr;
    const hasSource = media.some((m) => m.is_tryon_source);
    const { error } = await supabase.from("product_media").insert({
      id: mediaId,
      product_id: id,
      store_id: store.id,
      kind,
      storage_path: path,
      position: media.length,
      is_tryon_source: extra.is_tryon_source ?? (kind === "image" && !hasSource),
      extracted_from: extra.extracted_from ?? null,
    });
    if (error) throw error;
    return mediaId;
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    const video = list.find((f) => f.type.startsWith("video/"));
    const images = list.filter((f) => f.type.startsWith("image/"));
    setUploading(true);
    try {
      for (const img of images) await uploadMedia(img, "image", extensionOf(img));
      if (images.length) refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
    if (video) {
      if (video.size > 50 * 1024 * 1024) toast.error("Videos must be under 50 MB. Trim it and try again.");
      else setPendingVideo(video);
    }
  };

  const saveVideo = async (frame?: Blob) => {
    if (!pendingVideo) return;
    setUploading(true);
    try {
      const videoId = await uploadMedia(pendingVideo, "video", extensionOf(pendingVideo));
      if (frame) {
        await supabase.from("product_media").update({ is_tryon_source: false }).eq("product_id", id);
        await uploadMedia(frame, "image", "jpg", { is_tryon_source: true, extracted_from: videoId });
      }
      toast.success(frame ? "Video and try-on frame added" : "Video added");
      setPendingVideo(undefined);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const makeSource = async (mediaId: string) => {
    await supabase.from("product_media").update({ is_tryon_source: false }).eq("product_id", id);
    const { error } = await supabase.from("product_media").update({ is_tryon_source: true }).eq("id", mediaId);
    if (error) return toast.error(errorMessage(error));
    await supabase.from("products").update({ garment_notes: null }).eq("id", id);
    refresh();
  };

  const removeMedia = async (m: { id: string; storage_path: string }) => {
    await supabase.storage.from("store-media").remove([m.storage_path]);
    const { error } = await supabase.from("product_media").delete().eq("id", m.id);
    if (error) return toast.error(errorMessage(error));
    refresh();
  };

  const save = async () => {
    if (form.status === "active" && !media.some((m) => m.kind === "image")) return toast.error("Add at least one photo before listing this piece.");
    if (form.status === "active" && !variants.length) return toast.error("Add at least one size before listing this piece.");
    for (const v of variants) {
      if (!v.size_label.trim()) return toast.error("Every size needs a label, like M or 12.");
      if ((v.size_min && !v.size_max) || (!v.size_min && v.size_max)) return toast.error(`Size ${v.size_label}: choose both "fits from" and "to", or neither for one-size.`);
      if (v.size_min && Number(v.size_min) > Number(v.size_max)) return toast.error(`Size ${v.size_label}: "fits from" must be the smaller size.`);
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({
          name: form.name.trim(),
          category: form.category as never,
          garment_type: form.garmentType.trim().slice(0, 40) || null,
          length: (LENGTH_OPTIONS[form.category] && form.length ? form.length : null) as never,
          length_cm: Number(form.lengthCm) >= 5 && Number(form.lengthCm) <= 250 ? Number(form.lengthCm) : null,
          stretch: (form.stretch || null) as never,
          department: form.department,
          price_kes: Number(form.price_kes),
          description: form.description || null,
          status: form.status as never,
          is_one_of_a_kind: form.is_one_of_a_kind,
          ...(form.status === "active" ? { needs_review: false } : {}),
        })
        .eq("id", id);
      if (error) throw error;
      if (removed.length) {
        const { error: delErr } = await supabase.from("product_variants").delete().in("id", removed);
        if (delErr) throw delErr;
      }
      for (const v of variants) {
        const row = {
          product_id: id,
          size_label: v.size_label.trim(),
          size_system: form.sizeSystem,
          size_min: v.size_min ? Number(v.size_min) : null,
          size_max: v.size_max ? Number(v.size_max) : null,
          stock_qty: Math.max(0, Number(v.stock_qty) || 0),
          measurements: toMeasurements(
            Object.fromEntries(Object.entries(v.m).filter(([k]) => (MEASURES_FOR[form.category] ?? []).includes(k as MeasureKey))),
            measuredFlat,
          ) as never,
        };
        const { error: vErr } = v.id ? await supabase.from("product_variants").update(row).eq("id", v.id) : await supabase.from("product_variants").insert(row);
        if (vErr) throw vErr;
      }
      toast.success("Saved");
      refresh();
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["review-count"] });
      if (fromReview && form.status === "active") navigate("/studio/review");
    } catch (err) {
      toast.error(errorMessage(err).includes("product_variants_product_id_size_label_key") ? "Two sizes have the same label." : errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async () => {
    if (!window.confirm(`Delete "${product.data!.name}"? Shoppers' past try-ons stay, but the piece disappears from your rail.`)) return;
    await supabase.storage.from("store-media").remove(media.map((m) => m.storage_path));
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(errorMessage(error));
    queryClient.invalidateQueries({ queryKey: ["studio-products"] });
    navigate("/studio/products");
  };

  const setV = (i: number, k: Exclude<keyof VariantDraft, "m">, value: string) => setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, [k]: value } : v)));
  const setM = (i: number, k: MeasureKey, value: string) => setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, m: { ...v.m, [k]: value } } : v)));
  const measureKeys = MEASURES_FOR[form.category] ?? [];

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Edit piece" title={form.name || "Untitled"}>
        <div className="flex gap-2">
          <Button variant="danger" onClick={deleteProduct}>Delete</Button>
          <Button variant="accent" onClick={save} loading={saving}>Save</Button>
        </div>
      </PageHeader>

      {product.data.needs_review && (
        <div className="grid gap-2 border border-warn/40 bg-warn-soft p-4">
          <p className="font-semibold">Imported draft: check it before listing</p>
          <p className="text-[14px] text-muted">The AI wrote the name, type, price and sizes from your photo{product.data.source_caption ? " and caption" : ""}. Set the status to Listed and save when it's right.</p>
          {product.data.source_caption && <p className="whitespace-pre-wrap text-[13px]">“{product.data.source_caption}”</p>}
          {fromReview && <Link to="/studio/review" className="label text-ink underline underline-offset-4">Back to review</Link>}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <section className="grid content-start gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="display text-[26px]">Photos &amp; videos</h2>
            <span className="text-[13px] text-muted"><Star className="inline h-3.5 w-3.5 fill-accent text-accent" /> = photo used for try-on</span>
          </div>
          {pendingVideo ? (
            <VideoFramePicker file={pendingVideo} onPick={(frame) => saveVideo(frame)} onSkip={() => saveVideo()} />
          ) : (
            <label className={cn("grid cursor-pointer place-items-center gap-1 border border-dashed border-ink/40 bg-surface px-6 py-8 text-center hover:border-ink", uploading && "pointer-events-none opacity-60")}>
              <input type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple className="sr-only" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
              {uploading ? <Spinner /> : <Plus className="h-5 w-5" />}
              <span className="font-semibold">Add photos or a video</span>
              <span className="text-[13px] text-muted">For try-on, use a clear photo of the whole garment. Videos up to 50 MB.</span>
            </label>
          )}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {media.map((m) => (
              <figure key={m.id} className="grid gap-1">
                <div className={cn("relative aspect-[3/4] overflow-hidden bg-sunk", m.is_tryon_source && "outline outline-2 outline-accent")}>
                  {m.kind === "video" ? <video src={publicMediaUrl(m.storage_path)!} muted playsInline className="h-full w-full object-cover" /> : <img src={publicMediaUrl(m.storage_path)!} alt="" className="h-full w-full object-cover" />}
                  {m.kind === "video" && <Pill className="absolute left-1 top-1">Video</Pill>}
                  {m.extracted_from && <Pill tone="accent" className="absolute left-1 top-1">Frame</Pill>}
                </div>
                <figcaption className="flex justify-between">
                  {m.kind === "image" ? (
                    <button onClick={() => makeSource(m.id)} aria-label="Use for try-on" className="p-1" title="Use for try-on">
                      <Star className={cn("h-4 w-4", m.is_tryon_source ? "fill-accent text-accent" : "text-muted")} />
                    </button>
                  ) : <span />}
                  <button onClick={() => removeMedia(m)} aria-label="Remove" className="p-1 text-muted hover:text-bad"><Trash2 className="h-4 w-4" /></button>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="grid content-start gap-4 border border-rule bg-surface p-6">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Section">
              <Select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value as Department })}>
                {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </Select>
            </Field>
            <Field label="Size system">
              <Select
                value={form.sizeSystem}
                onChange={(e) => {
                  setForm({ ...form, sizeSystem: e.target.value as SizeSystem });
                  setVariants((vs) => vs.map((v) => ({ ...v, size_min: "", size_max: "" })));
                }}
              >
                {(Object.keys(SIZE_SYSTEMS) as SizeSystem[]).map((k) => <option key={k} value={k}>{SIZE_SYSTEMS[k].label}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {Object.entries(CATEGORY_SINGULAR).map(([k, v]) => <option key={k} value={k}>{v[0].toUpperCase() + v.slice(1)}</option>)}
              </Select>
            </Field>
            <Field label="Price (KES)"><Input type="number" min={0} value={form.price_kes} onChange={(e) => setForm({ ...form, price_kes: e.target.value })} className="num" /></Field>
          </div>
          <Field label="Exactly what it is" hint="e.g. hoodie, quarter-zip, blazer, cargo trousers. Helps the try-on draw it right.">
            <Input list="garment-types" value={form.garmentType} maxLength={40} onChange={(e) => setForm({ ...form, garmentType: e.target.value })} />
            <datalist id="garment-types">
              {(GARMENT_BY_CATEGORY[form.category]?.types ?? []).map((t) => <option key={t} value={t} />)}
            </datalist>
          </Field>
          {LENGTH_OPTIONS[form.category] && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Length" hint="Where it ends when worn. Try-ons draw the hem exactly here.">
                <Select value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })}>
                  <option value="">Read it from the photo</option>
                  {LENGTH_OPTIONS[form.category].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
              <Field label="Length (optional)" hint={["bottom", "skirt"].includes(form.category) ? "Waistband to hem, laid flat" : "Top of the shoulder to hem, laid flat"}>
                <LengthInput valueCm={form.lengthCm} onChangeCm={(cm) => setForm({ ...form, lengthCm: cm })} />
              </Field>
            </div>
          )}
          <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} placeholder="Fabric, fit, length, care…" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="draft">Draft (hidden)</option>
                <option value="active">Listed</option>
                <option value="sold_out">Sold out</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
            <label className="flex items-end gap-2 pb-3">
              <input type="checkbox" checked={form.is_one_of_a_kind} onChange={(e) => setForm({ ...form, is_one_of_a_kind: e.target.checked })} className="h-4 w-4 accent-ink" />
              One of a kind (mitumba)
            </label>
          </div>

          <div className="grid gap-3 border-t border-rule pt-4">
            <div className="grid gap-1">
              <span className="label">Sizes &amp; stock</span>
              <span className="text-[13px] text-muted">Label as you write it (M, 12, 32/34), the sizes it fits in {SIZE_SYSTEMS[form.sizeSystem].label}, and how many you have. Leave "fits from" empty for one-size.</span>
            </div>
            {!!measureKeys.length && (
              <div className="grid gap-2 border border-rule bg-paper p-3">
                <span className="text-[13px]">
                  <span className="font-medium">Measure each size</span> <span className="text-muted">so shoppers see how it fits their body and try-ons draw it the right tightness.</span>
                </span>
                <div className="flex flex-wrap items-center gap-4">
                  <LengthUnitToggle />
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
                    <input
                      type="checkbox"
                      checked={measuredFlat}
                      onChange={(e) => {
                        const flat = e.target.checked;
                        setMeasuredFlat(flat);
                        setVariants((vs) => vs.map((v) => ({ ...v, m: convertAround(v.m, flat) })));
                      }}
                      className="h-4 w-4 accent-ink"
                    />
                    I measure laid flat (we double bust, waist, hips, thigh)
                  </label>
                  <label className="flex items-center gap-2 text-[13px] text-muted">
                    Fabric
                    <Select value={form.stretch} onChange={(e) => setForm({ ...form, stretch: e.target.value })} className="h-9 w-40">
                      <option value="">Not sure</option>
                      {STRETCH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </label>
                </div>
              </div>
            )}
            {variants.map((v, i) => (
              <div key={v.id ?? `new-${i}`} className="grid gap-2 border-b border-rule pb-3 last:border-0">
              <div className="grid grid-cols-[1fr_1fr_1fr_80px_auto] items-end gap-2">
                <Field label="Label"><Input value={v.size_label} onChange={(e) => setV(i, "size_label", e.target.value)} maxLength={20} /></Field>
                <Field label="Fits from">
                  <Select value={v.size_min} onChange={(e) => setV(i, "size_min", e.target.value)} className="num">
                    <option value="">—</option>
                    {SIZE_SYSTEMS[form.sizeSystem].options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </Field>
                <Field label="To">
                  <Select value={v.size_max} onChange={(e) => setV(i, "size_max", e.target.value)} className="num">
                    <option value="">—</option>
                    {SIZE_SYSTEMS[form.sizeSystem].options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </Field>
                <Field label="Stock"><Input type="number" min={0} value={v.stock_qty} onChange={(e) => setV(i, "stock_qty", e.target.value)} className="num" /></Field>
                <button
                  onClick={() => {
                    if (v.id) setRemoved((r) => [...r, v.id!]);
                    setVariants((vs) => vs.filter((_, j) => j !== i));
                  }}
                  className="mb-2.5 p-1 text-muted hover:text-bad"
                  aria-label={`Remove size ${v.size_label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {!!measureKeys.length && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {measureKeys.map((k) => (
                    <label key={k} className="grid gap-1">
                      <span className="text-[11.5px] text-muted" title={MEASURE_LABELS[k].hint}>{MEASURE_LABELS[k].label}</span>
                      <LengthInput valueCm={v.m[k] ?? ""} onChangeCm={(cm) => setM(i, k, cm)} className="h-9" />
                    </label>
                  ))}
                </div>
              )}
              </div>
            ))}
            <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setVariants((vs) => [...vs, { size_label: "", size_min: "", size_max: "", stock_qty: "1", m: {} }])}>
              <Plus className="h-4 w-4" /> Add a size
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
