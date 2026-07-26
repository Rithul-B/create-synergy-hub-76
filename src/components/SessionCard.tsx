import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { ensureFreshSession, useSession, useSignOut } from "@/lib/session";

function formatTime(seconds?: number) {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleString();
}

export function SessionCard() {
  const { session, loading } = useSession();
  const signOut = useSignOut();
  const [busy, setBusy] = useState<"local" | "global" | "refresh" | null>(null);

  async function refreshNow() {
    setBusy("refresh");
    const fresh = await ensureFreshSession();
    setBusy(null);
    toast[fresh ? "success" : "error"](
      fresh ? "Session refreshed" : "Could not refresh session — please sign in again",
    );
  }

  async function doSignOut(scope: "local" | "global") {
    setBusy(scope);
    try {
      await signOut(scope);
      toast.success(scope === "global" ? "Signed out on all devices" : "Signed out");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">Session &amp; devices</h2>
      </div>

      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : session ? (
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Signed in as</p>
            <p className="font-medium break-all">{session.user.email ?? session.user.id}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Session renews</p>
            <p className="font-medium">{formatTime(session.expires_at)}</p>
          </div>
          <p className="text-muted-foreground sm:col-span-2">
            Your session stays signed in on every device and refreshes automatically in the
            background, so you can pick up where you left off.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No active session.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={refreshNow} disabled={busy !== null || !session}>
          {busy === "refresh" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
          Refresh session
        </Button>
        <Button variant="outline" size="sm" onClick={() => doSignOut("local")} disabled={busy !== null}>
          {busy === "local" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <LogOut className="h-4 w-4 mr-1" />}
          Sign out
        </Button>
        <Button variant="destructive" size="sm" onClick={() => doSignOut("global")} disabled={busy !== null}>
          {busy === "global" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Smartphone className="h-4 w-4 mr-1" />}
          Sign out everywhere
        </Button>
      </div>
    </Card>
  );
}
