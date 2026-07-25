/** Google via Supabase works on localhost when the redirect URL is allow-listed. */
export async function signInWithGoogleLocal() {
  const { supabase } = await import("@/integrations/supabase/client");
  const redirectTo = `${window.location.origin}/auth`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
}

export function shouldUseSupabaseGoogleAuth() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}
