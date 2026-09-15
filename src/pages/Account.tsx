import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useConsents, useIsAdmin, useMyStore, useProfile, useSetupStatus } from "@/lib/queries";
import { errorMessage } from "@/lib/utils";
import { Button, ButtonLink, PageHeader, Pill } from "@/components/ui";
import { FeedbackButton } from "@/components/FeedbackButton";
import { ThemePicker } from "@/components/ThemeToggle";
import { InstallAppSection } from "@/components/InstallApp";
import { BodyBasics } from "@/components/BodyBasics";
import { Measurements } from "@/components/Measurements";

const CONSENT_LABELS: Record<string, string> = {
  terms: "Terms and privacy policy",
  privacy_policy: "Privacy policy",
  body_photo_processing: "Processing my body photos",
  cross_border_transfer: "Sending photos to OpenAI (US) for try-ons",
  marketing: "Marketing messages",
};

export default function Account() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useProfile();
  const consents = useConsents();
  const setup = useSetupStatus();
  const store = useMyStore();
  const isAdmin = useIsAdmin();

  const withdraw = async (id: string) => {
    const { error } = await supabase.from("consents").update({ withdrawn_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(errorMessage(error));
    queryClient.invalidateQueries({ queryKey: ["consents"] });
    toast.success("Consent withdrawn. Try-ons are paused until you agree again.");
  };

  const requestDeletion = async () => {
    if (!window.confirm("Request deletion of your account, photos and try-ons? This can't be undone once processed.")) return;
    const { error } = await supabase.from("data_deletion_requests").insert({ user_id: user!.id });
    if (error) return toast.error(errorMessage(error));
    toast.success("Deletion requested. We'll complete it within 30 days and email you.");
  };

  const active = (consents.data ?? []).filter((c) => !c.withdrawn_at);

  return (
    <div className="grid gap-10">
      <PageHeader eyebrow="Account" title={profile.data?.display_name || "Your account"}>
        <div className="flex flex-wrap gap-2">
          <FeedbackButton variant="button" label="Send feedback" />
          <Button variant="outline" onClick={() => signOut().then(() => navigate("/"))}>Log out</Button>
        </div>
      </PageHeader>

      <div className="grid gap-px border border-rule bg-rule md:grid-cols-2">
        <section className="grid content-start gap-3 bg-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="display text-[26px]">Fitting profile</h2>
            <Pill tone={setup.ready ? "good" : "warn"}>{setup.ready ? "Ready" : "Unfinished"}</Pill>
          </div>
          <p className="text-muted">{user?.email}</p>
          <p className="text-muted">Photos, sizes, height, weight and date of birth.</p>
          <ButtonLink to="/me/setup" variant="outline" className="justify-self-start">Edit fitting profile</ButtonLink>
        </section>

        <section className="grid content-start gap-3 bg-surface p-6">
          <h2 className="display text-[26px]">Your store</h2>
          {store.data ? (
            <>
              <p className="text-muted">{store.data.name} · <span className="capitalize">{store.data.status}</span></p>
              <ButtonLink to="/studio" variant="outline" className="justify-self-start">Open Studio</ButtonLink>
            </>
          ) : (
            <>
              <p className="text-muted">Sell on ALTERNATE and earn from the followers you bring.</p>
              <ButtonLink to="/studio" variant="outline" className="justify-self-start">Open a store</ButtonLink>
            </>
          )}
          {isAdmin.data && <ButtonLink to="/admin" variant="solid" className="justify-self-start">Admin dashboard</ButtonLink>}
        </section>

        <section className="grid content-start gap-5 bg-surface p-6 md:col-span-2" id="body">
          <div className="grid gap-1">
            <h2 className="display text-[26px]">Your body</h2>
            <p className="text-muted">Keep these up to date: they decide where hems fall and how tightly clothes sit in your try-ons.</p>
          </div>
          <BodyBasics />
          <div className="grid gap-3 border-t border-rule pt-5">
            <h3 className="label text-ink">Measurements</h3>
            <Measurements />
          </div>
        </section>

        <section className="grid content-start gap-3 bg-surface p-6 md:col-span-2">
          <h2 className="display text-[26px]">Appearance</h2>
          <ThemePicker />
        </section>

        <section className="grid content-start gap-3 bg-surface p-6 md:col-span-2">
          <h2 className="display text-[26px]">ALTERNATE on your phone</h2>
          <InstallAppSection />
        </section>

        <section className="grid content-start gap-3 bg-surface p-6 md:col-span-2">
          <h2 className="display text-[26px]">Privacy &amp; your data</h2>
          <div className="grid gap-2">
            {active.length ? (
              active.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-rule py-2 last:border-0">
                  <div>
                    <p>{CONSENT_LABELS[c.consent_type]}</p>
                    <p className="num text-[12px] text-muted">Agreed {new Date(c.granted_at).toLocaleDateString("en-KE")} · {c.policy_version}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => withdraw(c.id)}>Withdraw</Button>
                </div>
              ))
            ) : (
              <p className="text-muted">You haven't given any consents yet.</p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
            <p className="max-w-[60ch] text-[14px] text-muted">Delete your account, body photos, screenshots and try-ons. Payment records are kept as the law requires.</p>
            <Button variant="danger" onClick={requestDeletion}>Delete my data</Button>
          </div>
        </section>
      </div>
    </div>
  );
}
