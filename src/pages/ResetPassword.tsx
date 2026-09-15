import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/utils";
import { Button, Field, Notice, Spinner } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";
import { Wordmark } from "@/components/Wordmark";
import { ThemeToggle } from "@/components/ThemeToggle";

/** Opened from the reset email: Supabase signs the person in from the link, then they pick a new password. */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    // The link may already have been processed by the time this page mounts
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setReady(true);
    });
    const timer = window.setTimeout(() => setReady((r) => r ?? false), 4000);
    return () => {
      data.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error("The two passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Password changed. You're signed in.");
    navigate("/", { replace: true });
  };

  return (
    <main className="min-h-dvh bg-paper px-5 pb-10 pt-6">
      <div className="flex justify-end"><ThemeToggle /></div>
      <div className="mx-auto grid max-w-md gap-8 py-4">
        <div className="grid gap-3 text-center">
          <Wordmark className="justify-center" />
          <h1 className="display text-[40px]">Choose a new password</h1>
        </div>
        {ready === null ? (
          <div className="grid place-items-center py-10"><Spinner /></div>
        ) : ready ? (
          <form onSubmit={submit} className="grid gap-4 border border-rule bg-surface p-6">
            <Field label="New password" hint="At least 8 characters">
              <PasswordInput required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="Type it again">
              <PasswordInput required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </Field>
            <Button type="submit" size="lg" loading={busy}>Save new password</Button>
          </form>
        ) : (
          <div className="grid gap-4">
            <Notice tone="bad" title="This reset link has expired or was already used">Ask for a new one and use it within an hour.</Notice>
            <Link to="/auth?mode=forgot" className="label justify-self-center text-ink underline underline-offset-4">Send a new link</Link>
          </div>
        )}
      </div>
    </main>
  );
}
