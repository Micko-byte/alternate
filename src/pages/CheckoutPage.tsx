import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { useCreditPacks, useSubscriptionPlans, useTryonPrices, useWallet } from "@/lib/queries";
import { QUALITY_LABELS } from "@/lib/tryon";
import { kes } from "@/lib/utils";
import { Notice, PageHeader, Spinner } from "@/components/ui";
import { Checkout, type CheckoutItem } from "@/components/Checkout";

/** /checkout/:packId for credit packs, /checkout/plan/:planId for a month of a plan. */
export default function CheckoutPage() {
  const { packId, planId } = useParams();
  const packs = useCreditPacks();
  const plans = useSubscriptionPlans();
  const prices = useTryonPrices();
  const wallet = useWallet();

  if (packs.isLoading || plans.isLoading) return <div className="grid place-items-center py-24"><Spinner /></div>;

  let item: CheckoutItem | null = null;
  let dailyLimit: number | null = null;
  if (planId) {
    const plan = plans.data?.find((p) => p.id === planId && p.is_active);
    if (plan) item = { kind: "plan", id: plan.id, name: plan.name, credits: plan.monthly_credits, price_kes: plan.price_kes };
    dailyLimit = plan?.daily_limit ?? null;
  } else {
    const pack = packs.data?.find((p) => p.id === packId && p.is_active);
    if (pack) item = { kind: "pack", id: pack.id, name: pack.name, credits: pack.credits, price_kes: pack.price_kes };
  }
  if (!item) return <Notice title="That option isn't available any more">Prices may have changed. <Link to="/credits" className="underline">See current plans and credits</Link></Notice>;

  const tries = (quality: "standard" | "hd" | "studio") => (prices.data?.[quality] ? Math.floor(item!.credits / prices.data[quality]) : null);
  const spendable = wallet.data?.spendable ?? 0;

  return (
    <div className="grid gap-10">
      <Link to="/credits" className="label inline-flex items-center gap-2 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Plans & credits</Link>
      <PageHeader eyebrow="Checkout" title="Complete your order" />

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_440px] lg:gap-14">
        <section className="grid gap-6">
          <div className="grid gap-4 border border-rule bg-surface p-6">
            <span className="label">Order summary</span>
            <div className="flex items-end justify-between gap-4">
              <div className="grid gap-1">
                <span className="display text-[44px]">{item.kind === "plan" ? `${item.name} plan` : item.credits === 1 ? "One try-on" : `${item.credits} credits`}</span>
                <span className="text-muted">
                  {item.kind === "plan" ? `30 days · ${item.credits} credits${dailyLimit ? ` · up to ${dailyLimit} try-ons a day` : ""}` : `${item.name} · credits never expire`}
                </span>
              </div>
              <span className="num text-[22px]">{kes(item.price_kes)}</span>
            </div>
            <dl className="grid gap-2 border-t border-rule pt-4 text-[14px]">
              <div className="flex justify-between"><dt className="text-muted">Credits you can spend now</dt><dd className="num">{spendable}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">After this purchase</dt><dd className="num">{spendable + item.credits}</dd></div>
              <div className="flex justify-between border-t border-rule pt-3 text-[16px] font-semibold"><dt>Total</dt><dd className="num">{kes(item.price_kes)}</dd></div>
            </dl>
            {item.kind === "plan" && (
              <p className="text-[13px] text-muted">
                {wallet.data?.paid_until ? `You already have a plan until ${new Date(wallet.data.paid_until).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}; this month starts after it. ` : ""}
                No automatic charges. Unused plan credits end with the month.
              </p>
            )}
          </div>

          <div className="grid gap-3 border border-rule bg-surface p-6">
            <span className="label">What {item.credits} credits get you</span>
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

        <Checkout item={item} inline />
      </div>
    </div>
  );
}
