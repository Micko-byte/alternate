import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { useCreditPacks, useCredits, useTryonPrices } from "@/lib/queries";
import { QUALITY_LABELS } from "@/lib/tryon";
import { kes } from "@/lib/utils";
import { Notice, PageHeader, Spinner } from "@/components/ui";
import { Checkout } from "@/components/Checkout";

export default function CheckoutPage() {
  const { packId } = useParams();
  const packs = useCreditPacks();
  const prices = useTryonPrices();
  const balance = useCredits();

  if (packs.isLoading) return <div className="grid place-items-center py-24"><Spinner /></div>;
  const pack = packs.data?.find((p) => p.id === packId && p.is_active);
  if (!pack) return <Notice title="That credit pack isn't available">It may have changed. <Link to="/credits" className="underline">See current packs</Link></Notice>;

  const tries = (quality: "standard" | "hd" | "studio") => (prices.data?.[quality] ? Math.floor(pack.credits / prices.data[quality]) : null);

  return (
    <div className="grid gap-10">
      <Link to="/credits" className="label inline-flex items-center gap-2 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Credits</Link>
      <PageHeader eyebrow="Checkout" title="Complete your order" />

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_440px] lg:gap-14">
        <section className="grid gap-6">
          <div className="grid gap-4 border border-rule bg-surface p-6">
            <span className="label">Order summary</span>
            <div className="flex items-end justify-between gap-4">
              <div className="grid gap-1">
                <span className="display text-[44px]">{pack.credits} credits</span>
                <span className="text-muted">{pack.name} pack</span>
              </div>
              <span className="num text-[22px]">{kes(pack.price_kes)}</span>
            </div>
            <dl className="grid gap-2 border-t border-rule pt-4 text-[14px]">
              <div className="flex justify-between"><dt className="text-muted">Credits you have now</dt><dd className="num">{balance.data ?? 0}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">After this purchase</dt><dd className="num">{(balance.data ?? 0) + pack.credits}</dd></div>
              <div className="flex justify-between border-t border-rule pt-3 text-[16px] font-semibold"><dt>Total</dt><dd className="num">{kes(pack.price_kes)}</dd></div>
            </dl>
          </div>

          <div className="grid gap-3 border border-rule bg-surface p-6">
            <span className="label">What {pack.credits} credits get you</span>
            <ul className="grid gap-2 text-[14px]">
              {(["standard", "hd", "studio"] as const).map((q) => (
                <li key={q} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2"><Check className="h-4 w-4 text-good" /> {QUALITY_LABELS[q].name} try-ons</span>
                  <span className="num text-muted">{tries(q) ?? "–"} × {prices.data?.[q] ?? "–"} cr</span>
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-muted">If a try-on fails, its credits come back automatically.</p>
          </div>
        </section>

        <Checkout pack={pack} inline />
      </div>
    </div>
  );
}
