import { useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { storedReferral } from "@/lib/referral";
import { errorMessage } from "@/lib/utils";
import type { FitStyle, ShopsFor } from "@/lib/sizes";
import { FitPicker } from "@/components/FitPicker";
import { ShopsForPicker, SizeFields, sizeKey } from "@/components/SizeFields";
import { Button, Field, Input, Notice } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";

export default function Auth() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [referral, setReferral] = useState(storedReferral());
  const [shopsFor, setShopsFor] = useState<ShopsFor>("women");
  const [fit, setFit] = useState<FitStyle>("regular");
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const next = params.get("next") || "/shop";
  if (user) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/me/setup`,
            data: {
              display_name: name.trim() || undefined,
              referral_code: referral.trim() || undefined,
              shops_for: shopsFor,
              preferred_fit: fit,
              sizes: Object.entries(sizes)
                .filter(([, v]) => v)
                .map(([key, v]) => {
                  const [category, system] = key.split(":");
                  return { category, system, value: Number(v) };
                }),
            },
          },
        });
        if (error) throw error;
        if (!data.session) setCheckEmail(true);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-md gap-8 py-4">
      <div className="grid gap-3 text-center">
        <Wordmark className="justify-center" />
        <h1 className="display text-[40px]">{mode === "signin" ? "Welcome back" : "Your fitting room"}</h1>
        <p className="text-muted">{mode === "signin" ? "Sign in to see your try-ons and credits." : "Create an account to try clothes on your own photo."}</p>
      </div>

      {checkEmail ? (
        <Notice tone="good" title="Check your email">
          We sent a link to {email}. Open it to confirm your account, then come back to set up your fitting profile.
        </Notice>
      ) : (
        <form onSubmit={submit} className="grid gap-4 border border-rule bg-surface p-6">
          <div className="grid grid-cols-2 border border-rule">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`h-10 text-[13px] font-semibold uppercase tracking-[0.08em] ${mode === m ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
          {mode === "signup" && (
            <Field label="Your name">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Wanjiru" />
            </Field>
          )}
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password" hint={mode === "signup" ? "At least 8 characters" : undefined}>
            <Input
              type="password"
              required
              minLength={mode === "signup" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </Field>
          {mode === "signup" && (
            <div className="grid gap-4 border-y border-rule py-4">
              <ShopsForPicker value={shopsFor} onChange={setShopsFor} />
              <div className="grid gap-2">
                <span className="label">Your usual sizes</span>
                <p className="text-[13px] text-muted">You'll only be offered pieces in stock in your size, and try-ons are drawn to fit it.</p>
                <SizeFields required shopsFor={shopsFor} values={sizes} onChange={(category, system, value) => setSizes((v) => ({ ...v, [sizeKey(category, system)]: value }))} />
              </div>
              <FitPicker value={fit} onChange={setFit} hint="how you like it" />
            </div>
          )}
          {mode === "signup" && (
            <Field label="Store code (optional)" hint="From the store link that sent you here">
              <Input value={referral} onChange={(e) => setReferral(e.target.value.toUpperCase())} className="num uppercase" />
            </Field>
          )}
          <Button type="submit" variant="accent" size="lg" loading={busy}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>
      )}
    </div>
  );
}
