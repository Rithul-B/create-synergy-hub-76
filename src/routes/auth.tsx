import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — LearnLab" },
      { name: "description", content: "Sign in to LearnLab to chat with AI, manage subjects, and generate presentations, audio, and video." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. Signing you in…");
        navigate({ to: "/dashboard" });
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset email sent.");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background via-accent/30 to-background p-4">
      <div className="w-full max-w-md space-y-6">
        <Link to="/" className="flex items-center gap-2 justify-center">
          <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-display text-3xl">LearnLab</span>
        </Link>
        <Card className="p-6 space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signin" ? "Sign in to continue learning." : mode === "signup" ? "Start your learning journey." : "We'll email you a reset link."}
            </p>
          </div>
          {mode !== "forgot" && (
            <>
              <Button type="button" variant="outline" className="w-full" onClick={google} disabled={loading}>
                <svg viewBox="0 0 48 48" className="h-4 w-4 mr-2"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                Continue with Google
              </Button>
              <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div></div>
            </>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {mode !== "forgot" && (
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </Button>
          </form>
          <div className="text-sm text-center space-y-1">
            {mode === "signin" && (
              <>
                <button onClick={() => setMode("forgot")} className="text-primary hover:underline">Forgot password?</button>
                <div className="text-muted-foreground">No account? <button onClick={() => setMode("signup")} className="text-primary hover:underline">Sign up</button></div>
              </>
            )}
            {mode === "signup" && (
              <div className="text-muted-foreground">Have an account? <button onClick={() => setMode("signin")} className="text-primary hover:underline">Sign in</button></div>
            )}
            {mode === "forgot" && (
              <button onClick={() => setMode("signin")} className="text-primary hover:underline">Back to sign in</button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
