import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ANSWER_STYLES, EDUCATION_LEVELS, LANGUAGES, parsePreferences, type LearningPreferences,
} from "@/lib/preferences";
import { readTheme, saveTheme, type Theme } from "@/lib/theme";
import { toast } from "sonner";
import { Settings as SettingsIcon, Loader2, Monitor, Sun, Moon, Sparkles, Bell } from "lucide-react";
import { pageTitle } from "@/lib/brand";
import { testAiConnection } from "@/lib/exam.functions";
import { requestReminderPermission, reminderPermission } from "@/lib/exam-reminders";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: pageTitle("Settings") }] }),
  component: SettingsPage,
});

/** Radix selects reject empty string values, so "unset" needs a sentinel. */
const UNSET = "__default__";

const THEMES: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function SettingsPage() {
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [prefs, setPrefs] = useState<LearningPreferences>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [notifPerm, setNotifPerm] = useState<string>("default");

  useEffect(() => {
    setTheme(readTheme());
    setNotifPerm(reminderPermission());
  }, []);

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, preferences")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return { email: auth.user.email ?? "", userId: auth.user.id, ...(data ?? {}) };
    },
  });

  useEffect(() => {
    if (!profile.data) return;
    setDisplayName(profile.data.display_name ?? "");
    setAvatarUrl(profile.data.avatar_url ?? "");
    setPrefs(parsePreferences(profile.data.preferences));
  }, [profile.data]);

  async function saveProfile() {
    if (!profile.data?.userId) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: profile.data.userId,
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        preferences: { ...prefs },
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (newPassword.length < 6) return toast.error("Use at least 6 characters");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match");
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setSavingPassword(false);
    }
  }

  function pickTheme(next: Theme) {
    setTheme(next);
    saveTheme(next);
  }

  async function testAi() {
    setTestingAi(true);
    setAiStatus(null);
    try {
      const result = await testAiConnection({});
      setAiStatus(result.ok ? `${result.message}` : `Unexpected: ${result.message}`);
      toast.success(result.backend === "offline" ? "Built-in AI is active" : "AI connection OK");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setAiStatus(msg);
      toast.error(msg);
    } finally {
      setTestingAi(false);
    }
  }

  async function enableNotifications() {
    const ok = await requestReminderPermission();
    setNotifPerm(reminderPermission());
    toast[ok ? "success" : "error"](ok ? "Reminders enabled" : "Notifications blocked in browser settings");
  }

  const initials = (displayName || profile.data?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <h1 className="font-display text-4xl flex items-center gap-2"><SettingsIcon className="h-8 w-8" /> Settings</h1>
        <p className="text-muted-foreground">Your account, how the tutor talks to you, and how the app looks.</p>
      </div>

      {profile.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <Card className="p-5 space-y-4">
            <h2 className="font-semibold">Profile</h2>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl || undefined} alt="" />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="text-sm text-muted-foreground">
                Signed in as <span className="text-foreground">{profile.data?.email}</span>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Display name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <Label>Avatar image URL</Label>
                <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div>
              <h2 className="font-semibold">Learning preferences</h2>
              <p className="text-sm text-muted-foreground">The AI tutor uses these on every new answer.</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Level</Label>
                <Select
                  value={prefs.educationLevel ?? UNSET}
                  onValueChange={(v) => setPrefs((p) => ({ ...p, educationLevel: v === UNSET ? undefined : v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSET}>Not set</SelectItem>
                    {EDUCATION_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Language</Label>
                <Select
                  value={prefs.language ?? UNSET}
                  onValueChange={(v) => setPrefs((p) => ({ ...p, language: v === UNSET ? undefined : v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSET}>English</SelectItem>
                    {LANGUAGES.filter((l) => l !== "English").map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Answer style</Label>
                <Select
                  value={prefs.answerStyle ?? UNSET}
                  onValueChange={(v) => setPrefs((p) => ({ ...p, answerStyle: v === UNSET ? undefined : v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSET}>Balanced</SelectItem>
                    {ANSWER_STYLES.filter((s) => s.value !== "balanced").map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving…</> : "Save changes"}
              </Button>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-500" /> AI setup (local development)</h2>
            <p className="text-sm text-muted-foreground">
              <strong>Good news:</strong> AI works right now in <strong>built-in study mode</strong> — no API key required.
              Chat, study plans, and syllabus text parsing all work automatically.
            </p>
            <p className="text-sm text-muted-foreground">
              For smarter answers and image syllabus scanning, optionally add a free Google key:
            </p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-primary underline">aistudio.google.com/apikey</a></li>
              <li>Click <strong>Create API key</strong> (free)</li>
              <li>Open your <code className="text-xs bg-muted px-1 rounded">.env</code> file in the project folder</li>
              <li>Paste: <code className="text-xs bg-muted px-1 rounded">GEMINI_API_KEY=your-key-here</code></li>
              <li>Restart <code className="text-xs bg-muted px-1 rounded">npm run dev</code></li>
            </ol>
            <p className="text-xs text-muted-foreground">Gemini enables: AI Tutor, syllabus scan, auto-plan. Slides/audio/video need Lovable's preview.</p>
            <Button variant="outline" size="sm" onClick={testAi} disabled={testingAi}>
              {testingAi ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Testing…</> : "Test AI connection"}
            </Button>
            {aiStatus && (
              <p className={`text-sm ${aiStatus.includes("Built-in") || aiStatus.includes("Connected") || aiStatus.includes("Gemini") || aiStatus.includes("Lovable") ? "text-emerald-600" : "text-destructive"}`}>
                {aiStatus}
              </p>
            )}
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Bell className="h-5 w-5 text-amber-500" /> Exam reminders</h2>
            <p className="text-sm text-muted-foreground">
              Get browser notifications 7, 3, and 1 day before each exam (and on exam day). Enable per exam in the Exams editor.
            </p>
            <p className="text-sm">Notification permission: <strong>{notifPerm}</strong></p>
            <Button variant="outline" size="sm" onClick={enableNotifications}>Enable reminders</Button>
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="font-semibold">Appearance</h2>
            <div className="flex gap-2 flex-wrap">
              {THEMES.map((t) => {
                const Icon = t.icon;
                return (
                  <Button
                    key={t.value}
                    variant={theme === t.value ? "default" : "outline"}
                    onClick={() => pickTheme(t.value)}
                    size="sm"
                  >
                    <Icon className="h-4 w-4 mr-1" /> {t.label}
                  </Button>
                );
              })}
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="font-semibold">Change password</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>New password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" />
              </div>
              <div>
                <Label>Confirm password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={changePassword} disabled={savingPassword || !newPassword}>
                {savingPassword ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Updating…</> : "Update password"}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
