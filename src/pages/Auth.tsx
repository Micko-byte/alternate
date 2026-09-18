import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { storedReferral } from "@/lib/referral";
import { cn, errorMessage } from "@/lib/utils";
import type { FitStyle, ShopsFor } from "@/lib/sizes";
import { FitPicker } from "@/components/FitPicker";
import { ShopsForPicker, SizeFields, sizeKey } from "@/components/SizeFields";
import { Button, Field, Input, Notice } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";
import { PasswordInput } from "@/components/PasswordInput";
import { ThemeToggle } from "@/components/ThemeToggle";

/** Signing up is four short screens, then the code we email. Signing in stays one screen. */
const STEPS = ["account", "shops", "sizes", "code"] as const;
type Step = (typeof STEPS)[number] | "otp";

const STEP_TITLE: Record<string, { title: string; blurb: string }> = {
  account: { title: "Create your account", blurb: "Name, email and a password. Nothing else yet." },
  shops: { title: "What do you shop for?", blurb: "So the rail only shows pieces you'd actually wear." },
  sizes: { title: "Your usual sizes", blurb: "You'll only be offered pieces in stock in your size, and try-ons are drawn to fit it." },
  code: { title: "Did a store send you?", blurb: "Type their code so they get credit for bringing you. Skip it if nobody did." },
  otp: { title: "Check your email", blurb: "We sent you a 6-digit code." },
};

const RESEND_SECONDS = 45;

export default function Auth() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const initialMode = params.get("mode");
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(initialMode === "signup" ? "signup" : initialMode === "forgot" ? "forgot" : "signin");
  const [step, setStep] = useState<Step>("account");
  const [resetSent, setResetSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [referral, setReferral] = useState(storedReferral());
  const [shopsFor, setShopsFor] = useState<ShopsFor>("women");
  const [fit, setFit] = useState<FitStyle>("regular");
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const asStore = params.get("as") === "store";
  // New shoppers add their photos next; stores go to Studio; everyone else lands in the app
  const next = params.get("next") || (asStore ? "/studio" : mode === "signup" ? "/me/setup" : "/");
  if (user) return <Navigate to={next} replace />;

  const stepIndex = STEPS.indexOf(step as (typeof STEPS)[number]);
  const goTo = (m: "signin" | "signup") => { setMode(m); setStep("account"); };

  const createAccount = async () => {
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
    if (!data.session) {
      setStep("otp");
      setCooldown(RESEND_SECONDS);
    }
  };

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
        if (!error) return;
        // An account that never confirmed its email gets the code again instead of an error
        if (/confirm/i.test(error.message)) {
          await supabase.auth.resend({ type: "signup", email });
          setMode("signup");
          setStep("otp");
          setCooldown(RESEND_SECONDS);
          toast("Confirm your email first. We've sent you a new code.");
          return;
        }
        throw error;
      } else if (step === "otp") {
        const { error } = await supabase.auth.verifyOtp({ email, token: otp.replace(/\D/g, ""), type: "signup" });
        if (error) throw error;
      } else if (step === "account") {
        if (password !== confirm) throw new Error("The two passwords don't match. Type the same one twice.");
        setStep("shops");
      } else if (step === "code") {
        await createAccount();
      } else {
        setStep(STEPS[stepIndex + 1]);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setCooldown(RESEND_SECONDS);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) return toast.error(errorMessage(error));
    toast.success(`New code sent to ${email}`);
  };

  const heading = mode === "forgot" ? "Reset your password" : mode === "signin" ? "Welcome back" : asStore && step === "account" ? "Open your store" : STEP_TITLE[step].title;
  const blurb = mode === "forgot"
    ? "Enter your email and we'll send you a link to choose a new password."
    : mode === "signin"
      ? "Sign in to your fitting room."
      : asStore && step === "account"
        ? "Create your account, then set up your store in Studio."
        : STEP_TITLE[step].blurb;

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
        <h1 className="display text-[40px]">{heading}</h1>
        <p className="text-muted">{blurb}</p>
      </div>

      {resetSent ? (
        <div className="grid gap-4">
          <Notice tone="good" title="Check your email">
            If an account uses {email}, a reset link is on its way. It works once and expires after an hour.
          </Notice>
          <button type="button" onClick={() => { setResetSent(false); setMode("signin"); }} className="label justify-self-center text-ink underline underline-offset-4">Back to sign in</button>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4 border border-rule bg-surface p-6">
          {mode !== "forgot" && step === "account" && <div className="grid grid-cols-2 border border-rule">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => goTo(m)}
                className={`h-10 text-[13px] font-semibold uppercase tracking-[0.08em] ${mode === m ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>}

          {mode === "signup" && step !== "otp" && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <span className="label">Step {stepIndex + 1} of {STEPS.length}</span>
                <span className="num text-[12px] text-muted">{Math.round(((stepIndex + 1) / STEPS.length) * 100)}%</span>
              </div>
              <div className="flex gap-1" aria-hidden>
                {STEPS.map((s, i) => <span key={s} className={cn("h-1 flex-1", i <= stepIndex ? "bg-ink" : "bg-sunk")} />)}
              </div>
            </div>
          )}

          {(mode !== "signup" || step === "account") && (
            <>
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
                  {mode === "signup" && (
                    <Field label="Confirm password" hint={confirm && password !== confirm ? "The two passwords don't match" : "Type it again"}>
                      <PasswordInput
                        required
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        autoComplete="new-password"
                        aria-invalid={!!confirm && password !== confirm}
                        className={confirm && password !== confirm ? "border-bad" : undefined}
                      />
                    </Field>
                  )}
                  {mode === "signin" && (
                    <button type="button" onClick={() => setMode("forgot")} className="label justify-self-end text-ink underline underline-offset-4">
                      Forgot password?
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {mode === "signup" && step === "shops" && <ShopsForPicker value={shopsFor} onChange={setShopsFor} />}

          {mode === "signup" && step === "sizes" && (
            <div className="grid gap-4">
              <SizeFields required shopsFor={shopsFor} values={sizes} onChange={(category, system, value) => setSizes((v) => ({ ...v, [sizeKey(category, system)]: value }))} />
              <FitPicker value={fit} onChange={setFit} hint="how you like it" />
            </div>
          )}

          {mode === "signup" && step === "code" && (
            <Field label="Store code (optional)" hint="From the store link that sent you here">
              <Input value={referral} onChange={(e) => setReferral(e.target.value.toUpperCase())} className="num uppercase" placeholder="ALT-1234" />
            </Field>
          )}

          {mode === "signup" && step === "otp" && (
            <div className="grid gap-4">
              <div className="flex items-center gap-3 border border-rule bg-sunk p-4">
                <MailCheck className="h-5 w-5 shrink-0" aria-hidden />
                <p className="text-[14px]">The code is in the email we sent to <span className="font-medium">{email}</span>. It lasts an hour.</p>
              </div>
              <Field label="6-digit code">
                <Input
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="000000"
                  className="num text-center text-[24px] tracking-[0.4em]"
                />
              </Field>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={resend} disabled={cooldown > 0} className="label text-ink underline underline-offset-4 disabled:text-muted disabled:no-underline">
                  {cooldown > 0 ? `Send another in ${cooldown}s` : "Send another code"}
                </button>
                <button type="button" onClick={() => { setStep("account"); setOtp(""); }} className="label text-muted underline underline-offset-4 hover:text-ink">
                  Wrong email?
                </button>
              </div>
            </div>
          )}

          <Button type="submit" variant="accent" size="lg" loading={busy} disabled={step === "account" && mode === "signup" && !!confirm && password !== confirm}>
            {mode === "forgot" ? "Send reset link" : mode === "signin" ? "Sign in" : step === "otp" ? "Confirm and start" : step === "code" ? "Finish setup" : "Continue"}
            {mode === "signup" && step !== "otp" && <ArrowRight className="h-4 w-4" />}
          </Button>

          {mode === "signup" && stepIndex > 0 && (
            <button type="button" onClick={() => setStep(STEPS[stepIndex - 1])} className="label justify-self-center text-muted underline underline-offset-4 hover:text-ink">
              Back a step
            </button>
          )}
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
