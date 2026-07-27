import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Refresh the access token when it expires within this window (seconds). */
const REFRESH_MARGIN_SECONDS = 120;

export type SessionState = {
  session: Session | null;
  loading: boolean;
};

/**
 * Live session state, kept in sync across tabs and devices.
 * Supabase persists the session in localStorage and broadcasts auth events,
 * so every open tab reacts to sign-in, sign-out and token refresh.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setState({ session: data.session ?? null, loading: false });
      })
      .catch(() => {
        if (active) setState({ session: null, loading: false });
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ session: session ?? null, loading: false });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

/**
 * Refresh the access token when it is missing or close to expiry.
 * Returns the current (possibly refreshed) session, or null when signed out.
 */
export async function ensureFreshSession(): Promise<Session | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return null;

    const expiresAt = session.expires_at ?? 0;
    const secondsLeft = expiresAt - Math.floor(Date.now() / 1000);
    if (secondsLeft > REFRESH_MARGIN_SECONDS) return session;

    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error) return session;
    return refreshed.session ?? session;
  } catch {
    return null;
  }
}

/**
 * Keeps a long-lived tab authenticated: revalidates the token whenever the tab
 * regains focus or the device comes back online (e.g. laptop waking from sleep,
 * phone returning from background), on top of Supabase's own auto-refresh timer.
 */
export function useSessionKeepAlive() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const revalidate = async () => {
      if (document.visibilityState !== "visible") return;
      const session = await ensureFreshSession();
      if (!session) return;

      // Register/refresh this browser in the connected-devices list and honour
      // a revoke issued from another device.
      const { touchCurrentDevice } = await import("@/lib/devices");
      try {
        const allowed = await touchCurrentDevice();
        if (!allowed) {
          await supabase.auth.signOut({ scope: "local" });
          window.location.assign("/auth");
        }
      } catch {
        /* device tracking is best-effort */
      }
    };

    void revalidate();
    const interval = window.setInterval(() => void revalidate(), 5 * 60 * 1000);
    const onEvent = () => void revalidate();
    document.addEventListener("visibilitychange", onEvent);
    window.addEventListener("online", onEvent);
    window.addEventListener("focus", onEvent);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onEvent);
      window.removeEventListener("online", onEvent);
      window.removeEventListener("focus", onEvent);
    };
  }, []);
}


/**
 * Secure sign-out: cancel in-flight requests, drop cached protected data,
 * clear the Supabase session, then replace history so Back can't restore
 * the signed-in shell. `scope: "global"` revokes every device's refresh token.
 */
export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  return useCallback(
    async (scope: "local" | "global" = "local") => {
      await qc.cancelQueries();
      qc.clear();
      try {
        await supabase.auth.signOut({ scope });
      } catch {
        // Session may already be gone server-side; local state is cleared below.
      }
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        /* no-op */
      }
      navigate({ to: "/auth", replace: true });
    },
    [qc, navigate],
  );
}
