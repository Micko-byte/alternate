import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { kes, publicMediaUrl } from "@/lib/utils";

/** Pieces in Nairobi stores that look like the shopper's inspiration photo, from the photo checks already made. */
export function SimilarPieces({ garmentUploadId }: { garmentUploadId: string }) {
  const matches = useQuery({
    queryKey: ["similar-pieces", garmentUploadId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("similar_pieces", { _garment_upload_id: garmentUploadId, _limit: 8 });
      if (error) throw error;
      return data ?? [];
    },
    // The photo check finishes a few seconds after upload
    refetchInterval: (q) => (q.state.data?.length || q.state.dataUpdateCount > 4 ? false : 5000),
  });

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule pb-3">
        <h2 className="label text-ink">In Nairobi stores now</h2>
        <Link to="/shop" className="label hover:text-ink">Browse the shop</Link>
      </div>
      {matches.data?.length ? (
        <div className="flex snap-x gap-3 overflow-x-auto pb-1">
          {matches.data.map((m) => (
            <Link key={m.product_id} to={`/shop/${m.product_id}`} className="group grid w-40 shrink-0 snap-start gap-1.5">
              <span className="aspect-[3/4] overflow-hidden bg-sunk">
                {m.image_path && <img src={publicMediaUrl(m.image_path)!} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />}
              </span>
              <span className="line-clamp-2 text-[13.5px] font-medium">{m.name}</span>
              <span className="text-[12px] text-muted">{m.store_name} · <span className="num text-ink">{kes(m.price_kes)}</span></span>
              {!!m.reasons?.length && <span className="text-[11.5px] text-muted">{m.reasons.join(" · ")}</span>}
            </Link>
          ))}
        </div>
      ) : (
        <p className="flex flex-wrap items-center gap-2 text-[13.5px] text-muted">
          {matches.isLoading ? "Looking through store rails…" : "Nothing close in our stores yet. Try it on anyway, or"}
          {!matches.isLoading && <Link to="/shop" className="inline-flex items-center gap-1 text-ink underline underline-offset-4">see what's new <ArrowRight className="h-3.5 w-3.5" /></Link>}
        </p>
      )}
    </section>
  );
}
