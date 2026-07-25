import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { APP_NAME, pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: pageTitle("Reset password") }] }),
  component: ResetPage,
});

function ResetPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/30 to-background p-4">
      <div className="max-w-md mx-auto flex justify-end pt-2">
        <ThemeToggle />
      </div>
      <div className="grid place-items-center min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-md space-y-6">
          <Link to="/" className="flex items-center gap-2 justify-center">
            <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-display text-3xl">{APP_NAME}</span>
          </Link>
          <Card className="p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Set new password</h1>
            <p className="text-sm text-muted-foreground">Choose a strong password to secure your account.</p>
            <form onSubmit={submit} className="space-y-3">
              <Label htmlFor="p">New password</Label>
              <Input id="p" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button className="w-full" disabled={loading}>{loading ? "…" : "Update password"}</Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
