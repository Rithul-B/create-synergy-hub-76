import { supabase } from "@/integrations/supabase/client";

const DEVICE_ID_KEY = "studyforge-device-id";

export type DeviceRecord = {
  id: string;
  device_id: string;
  label: string;
  user_agent: string | null;
  platform: string | null;
  last_seen_at: string;
  revoked_at: string | null;
  created_at: string;
};

/** Stable per-browser identifier, generated once and kept in localStorage. */
export function getDeviceId(): string | null {
  if (typeof localStorage === "undefined") return null;
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function describeDevice() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const platform =
    typeof navigator !== "undefined"
      ? ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
          ?.platform ?? navigator.platform ?? "")
      : "";

  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : /Firefox\//.test(ua)
            ? "Firefox"
            : "Browser";

  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : platform || "Unknown";

  return { label: `${browser} on ${os}`, ua, platform };
}

/**
 * Record (or refresh) this browser in the user's connected-devices list.
 * Returns true when this device is still allowed, false when it was revoked
 * from another device.
 */
export async function touchCurrentDevice(): Promise<boolean> {
  const deviceId = getDeviceId();
  if (!deviceId) return true;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return true;

  const { data: existing } = await supabase
    .from("user_devices")
    .select("id, revoked_at")
    .eq("user_id", auth.user.id)
    .eq("device_id", deviceId)
    .maybeSingle();

  if (existing?.revoked_at) return false;

  const { label, ua, platform } = describeDevice();
  await supabase.from("user_devices").upsert(
    {
      user_id: auth.user.id,
      device_id: deviceId,
      label,
      user_agent: ua,
      platform,
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    },
    { onConflict: "user_id,device_id" },
  );

  return true;
}

export async function listDevices(): Promise<DeviceRecord[]> {
  const { data, error } = await supabase
    .from("user_devices")
    .select("id, device_id, label, user_agent, platform, last_seen_at, revoked_at, created_at")
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as DeviceRecord[];
}

/** Mark one device as revoked. That device signs itself out on its next check. */
export async function revokeDevice(id: string): Promise<void> {
  const { error } = await supabase
    .from("user_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
