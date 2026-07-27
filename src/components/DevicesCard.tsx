import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, Loader2, MonitorSmartphone, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDeviceId, listDevices, revokeDevice } from "@/lib/devices";
import { useSignOut } from "@/lib/session";

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 2) return "Active now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

export function DevicesCard() {
  const qc = useQueryClient();
  const signOut = useSignOut();
  const currentId = typeof window === "undefined" ? null : getDeviceId();

  const devices = useQuery({
    queryKey: ["user-devices"],
    queryFn: listDevices,
    refetchInterval: 60_000,
  });

  const revoke = useMutation({
    mutationFn: revokeDevice,
    onSuccess: (_d, id) => {
      const wasCurrent = devices.data?.find((x) => x.id === id)?.device_id === currentId;
      qc.invalidateQueries({ queryKey: ["user-devices"] });
      if (wasCurrent) {
        toast.success("This device signed out");
        void signOut("local");
      } else {
        toast.success("Device revoked — it will be signed out shortly");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not revoke device"),
  });

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MonitorSmartphone className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">Connected devices</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Every browser you sign in with appears here. Revoke one to sign it out without touching your
        other devices.
      </p>

      {devices.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : devices.data?.length ? (
        <ul className="divide-y rounded-md border">
          {devices.data.map((d) => {
            const isCurrent = d.device_id === currentId;
            const Icon = /iOS|Android/i.test(d.platform ?? "") ? Smartphone : Laptop;
            return (
              <li key={d.id} className="flex items-center gap-3 p-3">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {d.label}
                    {isCurrent && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {relative(d.last_seen_at)} · added{" "}
                    {new Date(d.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(d.id)}
                >
                  {revoke.isPending && revoke.variables === d.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    "Sign out"
                  ) : (
                    "Revoke"
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No devices recorded yet.</p>
      )}
    </Card>
  );
}
