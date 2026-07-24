import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — LearnLab" }] }),
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
    <div className="min-h-screen grid place-items-center p-4">
      <Card className="p-6 w-full max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Set new password</h1>
        <form onSubmit={submit} className="space-y-3">
          <Label htmlFor="p">New password</Label>
          <Input id="p" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button className="w-full" disabled={loading}>{loading ? "…" : "Update password"}</Button>
        </form>
      </Card>
    </div>
  );
}
