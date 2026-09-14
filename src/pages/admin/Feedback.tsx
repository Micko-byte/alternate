import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FEEDBACK_CATEGORIES } from "@/components/FeedbackButton";
import { cn, errorMessage } from "@/lib/utils";
import { Button, Empty, PageHeader, Pill, Select, Spinner, Textarea } from "@/components/ui";

type Row = { id: string; created_at: string; category: string; rating: number | null; message: string; page: string | null; status: string; admin_note: string | null; tryon_id: string | null; user_email: string | null };

const STATUS_TONE = { new: "accent", read: "neutral", planned: "warn", done: "good" } as const;

export default function AdminFeedback() {
  const [filter, setFilter] = useState("all");
  const feedback = useQuery({
    queryKey: ["admin-feedback"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_feedback");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = (feedback.data ?? []).filter((f) => filter === "all" || f.category === filter);
  const rated = (feedback.data ?? []).filter((f) => f.rating);
  const average = rated.length ? (rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length).toFixed(1) : null;

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Admin · feedback" title="What clients tell us">
        <div className="grid justify-items-end">
          <span className="display text-[44px]">{average ?? "—"}</span>
          <span className="label">average of {rated.length} ratings</span>
        </div>
      </PageHeader>

      <div className="flex flex-wrap gap-1.5">
        {[["all", "Everything"], ...FEEDBACK_CATEGORIES.map((c) => [c.value, c.label])].map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v)} aria-pressed={filter === v} className={cn("h-9 border px-3 font-mono text-[11px] font-semibold uppercase tracking-label", filter === v ? "border-ink bg-ink text-paper" : "border-rule text-muted hover:border-ink hover:text-ink")}>
            {label}
          </button>
        ))}
      </div>

      {feedback.isLoading ? (
        <div className="grid place-items-center py-20"><Spinner /></div>
      ) : !rows.length ? (
        <Empty title="No feedback yet">It appears here when clients use the Feedback button.</Empty>
      ) : (
        <div className="grid gap-3">
          {rows.map((f) => <FeedbackCard key={f.id} row={f} onChange={() => feedback.refetch()} />)}
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ row, onChange }: { row: Row; onChange: () => void }) {
  const [note, setNote] = useState(row.admin_note ?? "");
  const [busy, setBusy] = useState(false);

  const save = async (patch: { status?: string; admin_note?: string | null }) => {
    setBusy(true);
    const { error } = await supabase.from("feedback").update(patch as never).eq("id", row.id);
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    onChange();
  };

  return (
    <article className={cn("grid gap-4 border bg-surface p-5 md:grid-cols-[1fr_280px]", row.status === "new" ? "border-ink" : "border-rule")}>
      <div className="grid content-start gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={STATUS_TONE[row.status as keyof typeof STATUS_TONE]}>{row.status}</Pill>
          <Pill>{FEEDBACK_CATEGORIES.find((c) => c.value === row.category)?.label ?? row.category}</Pill>
          {row.rating && (
            <span className="flex items-center gap-0.5" aria-label={`${row.rating} of 5`}>
              {Array.from({ length: 5 }, (_, i) => <Star key={i} className={cn("h-3.5 w-3.5", i < row.rating! ? "fill-mustard text-mustard" : "text-rule")} />)}
            </span>
          )}
        </div>
        <p className="whitespace-pre-wrap text-[15px]">{row.message}</p>
        <p className="text-[12.5px] text-muted">
          {row.user_email ?? "Deleted account"} · {new Date(row.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
          {row.page && ` · from ${row.page}`}
          {row.tryon_id && <> · <Link to={`/try/${row.tryon_id}`} className="underline">see the try-on</Link></>}
        </p>
      </div>
      <div className="grid content-start gap-2">
        <Select value={row.status} disabled={busy} onChange={(e) => save({ status: e.target.value })} aria-label="Status">
          <option value="new">New</option>
          <option value="read">Read</option>
          <option value="planned">Planned</option>
          <option value="done">Done</option>
        </Select>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Private note for the team" className="min-h-[70px] text-[13px]" maxLength={2000} />
        {note !== (row.admin_note ?? "") && <Button size="sm" loading={busy} onClick={() => save({ admin_note: note || null })}>Save note</Button>}
      </div>
    </article>
  );
}
