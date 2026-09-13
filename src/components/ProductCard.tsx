import { Link } from "react-router-dom";
import { Pill } from "@/components/ui";
import { fitFor, type Variant } from "@/lib/queries";
import type { UserSize } from "@/lib/sizes";
import { kes, publicMediaUrl } from "@/lib/utils";

export type ProductWithRelations = {
  id: string;
  name: string;
  category: string;
  department?: string;
  price_kes: number;
  status: string;
  stores: { name: string; slug: string };
  product_media: { kind: string; storage_path: string; position: number; is_tryon_source: boolean }[];
  product_variants: Variant[];
};

export function coverImage(media: ProductWithRelations["product_media"]) {
  const images = media.filter((m) => m.kind === "image").sort((a, b) => a.position - b.position);
  return publicMediaUrl(images[0]?.storage_path);
}

export function ProductCard({ product, sizes, signedIn }: { product: ProductWithRelations; sizes?: UserSize[]; signedIn: boolean }) {
  const images = product.product_media.filter((m) => m.kind === "image").sort((a, b) => a.position - b.position);
  const cover = publicMediaUrl(images[0]?.storage_path);
  const second = publicMediaUrl(images[1]?.storage_path);
  const fit = fitFor(product.product_variants, sizes, product.category).state;
  const hasVideo = product.product_media.some((m) => m.kind === "video");
  const inStock = product.product_variants.filter((v) => v.stock_qty > 0);

  return (
    <Link to={`/shop/${product.id}`} className="group grid gap-3">
      <div className="relative aspect-[3/4] overflow-hidden bg-sunk">
        {cover ? (
          <>
            <img src={cover} alt={product.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            {second && <img src={second} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />}
          </>
        ) : (
          <div className="grid h-full place-items-center display text-[24px] text-muted">No photo yet</div>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {fit === "sold-out" && <Pill tone="ink">Sold out</Pill>}
          {signedIn && fit === "fits" && <Pill tone="accent">In your size</Pill>}
          {hasVideo && <Pill>Video</Pill>}
        </div>
        {inStock.length > 0 && (
          <div className="absolute inset-x-2 bottom-2 translate-y-2 bg-paper/95 px-3 py-2.5 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
            <span className="label text-ink">{signedIn && fit === "not-in-size" ? "Not in your size" : "Try on"}</span>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {inStock.map((v) => (
                <span key={v.id} className="num border border-rule px-1.5 py-0.5 text-[11px]">{v.size_label}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="grid gap-1">
        <span className="label">{product.stores.name}</span>
        <span className="text-[15px] font-medium leading-snug">{product.name}</span>
        <span className="num text-[14px] text-muted">{kes(product.price_kes)}</span>
      </div>
    </Link>
  );
}
