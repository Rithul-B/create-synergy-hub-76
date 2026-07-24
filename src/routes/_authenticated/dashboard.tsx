import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { MessageSquare, BookOpen, Presentation, AudioLines, Video, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LearnLab" }] }),
  component: Dashboard,
});

function Dashboard() {
  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [threads, subjects, gen] = await Promise.all([
        supabase.from("threads").select("id", { count: "exact", head: true }),
        supabase.from("subjects").select("id", { count: "exact", head: true }),
        supabase.from("generated_content").select("id, kind"),
      ]);
      const genList = gen.data ?? [];
      return {
        threads: threads.count ?? 0,
        subjects: subjects.count ?? 0,
        ppt: genList.filter((g) => g.kind === "powerpoint").length,
        audio: genList.filter((g) => g.kind === "audio").length,
        video: genList.filter((g) => g.kind === "video").length,
      };
    },
  });
  const recent = useQuery({
    queryKey: ["recent-threads"],
    queryFn: async () => {
      const { data } = await supabase.from("threads").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  const s = stats.data;
  const tiles = [
    { to: "/chat", label: "Start a chat", icon: MessageSquare, color: "bg-blue-500/10 text-blue-600" },
    { to: "/subjects", label: "Manage subjects", icon: BookOpen, color: "bg-emerald-500/10 text-emerald-600" },
    { to: "/powerpoint", label: "Create PowerPoint", icon: Presentation, color: "bg-orange-500/10 text-orange-600" },
    { to: "/audio", label: "Generate audio", icon: AudioLines, color: "bg-pink-500/10 text-pink-600" },
    { to: "/video", label: "Plan a video", icon: Video, color: "bg-purple-500/10 text-purple-600" },
  ] as const;

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">
      <div>
        <h1 className="font-display text-4xl">Welcome back</h1>
        <p className="text-muted-foreground mt-1">Pick up where you left off, or start something new.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Threads" value={s?.threads ?? 0} />
        <Stat label="Subjects" value={s?.subjects ?? 0} />
        <Stat label="Decks" value={s?.ppt ?? 0} />
        <Stat label="Audios" value={s?.audio ?? 0} />
        <Stat label="Videos" value={s?.video ?? 0} />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to}>
            <Card className="p-5 hover:border-primary transition h-full">
              <div className={`h-10 w-10 rounded-lg grid place-items-center ${t.color}`}><t.icon className="h-5 w-5" /></div>
              <div className="mt-3 font-medium">{t.label}</div>
              <ArrowRight className="h-4 w-4 mt-2 text-muted-foreground" />
            </Card>
          </Link>
        ))}
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent chats</h2>
        {recent.data?.length === 0 && <p className="text-sm text-muted-foreground">No chats yet.</p>}
        <div className="space-y-2">
          {recent.data?.map((t) => (
            <Link key={t.id} to="/chat/$threadId" params={{ threadId: t.id }}>
              <Card className="p-4 flex items-center justify-between hover:border-primary">
                <span className="truncate">{t.title}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
    </Card>
  );
}
