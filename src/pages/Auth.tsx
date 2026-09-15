import { useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
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
import { PasswordInput } from "@/components/PasswordInput";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Auth() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const initialMode = params.get("mode");
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(initialMode === "signup" ? "signup" : initialMode === "forgot" ? "forgot" : "signin");
  const [resetSent, setResetSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [referral, setReferral] = useState(storedReferral());
  const [shopsFor, setShopsFor] = useState<ShopsFor>("women");
  const [fit, setFit] = useState<FitStyle>("regular");
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const asStore = params.get("as") === "store";
  // New shoppers set up their fitting profile; stores go to Studio; everyone else lands in the app
  const next = params.get("next") || (asStore ? "/studio" : mode === "signup" ? "/me/setup" : "/");
  if (user) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setResetSent(true);
      } else if (mode === "signin") {
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
    <main className="min-h-dvh bg-paper px-5 pb-10 pt-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="label inline-flex items-center gap-2 py-2 hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <ThemeToggle />
      </div>
    <div className="mx-auto grid max-w-md gap-8 py-4">
      <div className="grid gap-3 text-center">
        <Wordmark className="justify-center" />
        <h1 className="display text-[40px]">{mode === "forgot" ? "Reset your password" : mode === "signin" ? "Welcome back" : asStore ? "Open your store" : "Create your account"}</h1>
        <p className="text-muted">
          {mode === "forgot"
            ? "Enter your email and we'll send you a link to choose a new password."
            : mode === "signin"
              ? "Sign in to your fitting room."
              : asStore
                ? "Create your account, then set up your store in Studio."
                : "One account for trying on, your wardrobe and credits."}
        </p>
      </div>

      {resetSent ? (
        <div className="grid gap-4">
          <Notice tone="good" title="Check your email">
            If an account uses {email}, a reset link is on its way. It works once and expires after an hour.
          </Notice>
          <button type="button" onClick={() => { setResetSent(false); setMode("signin"); }} className="label justify-self-center text-ink underline underline-offset-4">Back to sign in</button>
        </div>
      ) : checkEmail ? (
        <Notice tone="good" title="Check your email">
          We sent a link to {email}. Open it to confirm your account, then come back to set up your fitting profile.
        </Notice>
      ) : (
        <form onSubmit={submit} className="grid gap-4 border border-rule bg-surface p-6">
          {mode !== "forgot" && <div className="grid grid-cols-2 border border-rule">
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
          </div>}
          {mode === "signup" && (
            <Field label="Your name">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Wanjiru" />
            </Field>
          )}
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          {mode !== "forgot" && (
            <div className="grid gap-1.5">
              <Field label="Password" hint={mode === "signup" ? "At least 8 characters" : undefined}>
                <PasswordInput
                  required
                  minLength={mode === "signup" ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
              </Field>
              {mode === "signin" && (
                <button type="button" onClick={() => setMode("forgot")} className="label justify-self-end text-ink underline underline-offset-4">
                  Forgot password?
                </button>
              )}
            </div>
          )}
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
            {mode === "forgot" ? "Send reset link" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
          {mode === "forgot" && (
            <button type="button" onClick={() => setMode("signin")} className="label justify-self-center text-ink underline underline-offset-4">
              Back to sign in
            </button>
          )}
        </form>
      )}
    </div>
    </main>
  );
}
