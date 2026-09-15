import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * The browser can still hold a sign-in that the server has already ended (for example after logging out
 * everywhere, or a password change). Data still loads, but anything checked on the server refuses it.
 * Clear it on this device and send the person to sign in again, back to where they were.
 */
export async function endStaleSession() {
  await supabase.auth.signOut({ scope: "local" });
  toast.error("Your sign-in has ended. Please sign in again.");
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/auth?next=${encodeURIComponent(next)}`);
}

function isEndedSession(error: { status?: number; name?: string; message?: string } | null) {
  if (!error) return false;
  return error.status === 401 || error.status === 403 || error.name === "AuthSessionMissingError" || /session.*(not exist|missing|expired)|invalid jwt/i.test(error.message ?? "");
}

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      // Ask the server whether the saved sign-in is still valid (offline errors are ignored)
      if (data.session) {
        const { error } = await supabase.auth.getUser();
        if (isEndedSession(error)) {
          await supabase.auth.signOut({ scope: "local" });
          setSession(null);
          setLoading(false);
          return;
        }
      }
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // This device only: logging out on your phone shouldn't end your sign-in on your laptop
    await supabase.auth.signOut({ scope: "local" });
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
