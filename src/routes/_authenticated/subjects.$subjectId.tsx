import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { audioSrcFor, downloadContent } from "@/lib/content-actions";
import { toast } from "sonner";
import {
  MessageSquare, Plus, ArrowLeft, Download, Play, Loader2,
  Presentation, AudioLines, Video, Library,
} from "lucide-react";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/subjects/$subjectId")({
  head: () => ({ meta: [{ title: pageTitle("Subject") }] }),
  component: SubjectDetail,
});

const KIND_ICON: Record<string, typeof Presentation> = {
  powerpoint: Presentation,
  audio: AudioLines,
  video: Video,
};

function SubjectDetail() {
  const { subjectId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [audio, setAudio] = useState<{ id: string; src: string } | null>(null);

  const subject = useQuery({
    queryKey: ["subject", subjectId],
    queryFn: async () => {
      const { data } = await supabase.from("subjects").select("*").eq("id", subjectId).single();
      return data;
    },
  });
  const threads = useQuery({
    queryKey: ["subject-threads", subjectId],
    queryFn: async () => {
      const { data } = await supabase.from("threads").select("id, title, updated_at").eq("subject_id", subjectId).order("updated_at", { ascending: false });
      return data ?? [];
    },
  });
  const content = useQuery({
    queryKey: ["subject-content", subjectId],
    queryFn: async () => {
      const { data } = await supabase.from("generated_content").select("id, kind, title, created_at").eq("subject_id", subjectId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function newChat() {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data, error } = await supabase.from("threads").insert({ user_id: user.user.id, title: "New chat", subject_id: subjectId }).select("id").single();
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["subject-threads", subjectId] });
    navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
  }

  async function play(id: string) {
    setBusyId(id);
    try {
      setAudio({ id, src: await audioSrcFor(id) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not play this recording");
    } finally {
      setBusyId(null);
    }
  }

  async function download(item: { id: string; kind: string; title: string }) {
    setBusyId(item.id);
    try {
      await downloadContent(item);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      <Link to="/subjects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All subjects</Link>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="h-12 w-12 rounded-lg" style={{ backgroundColor: subject.data?.color }} />
          <h1 className="font-display text-4xl mt-3">{subject.data?.name}</h1>
          {subject.data?.description && <p className="text-muted-foreground">{subject.data.description}</p>}
        </div>
        <Button onClick={newChat}><Plus className="h-4 w-4 mr-1" /> New chat</Button>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h2 className="font-semibold mb-3">Chats</h2>
          {threads.isPending && <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}
          {threads.isSuccess && threads.data.length === 0 && <p className="text-sm text-muted-foreground">No chats in this subject yet.</p>}
          <div className="space-y-2">
            {threads.data?.map((t) => (
              <Link key={t.id} to="/chat/$threadId" params={{ threadId: t.id }}>
                <Card className="p-3 hover:border-primary flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{t.title}</span>
                </Card>
              </Link>
            ))}
          </div>
        </section>
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Saved content</h2>
            <Link to="/library" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <Library className="h-3.5 w-3.5" /> All work
            </Link>
          </div>
          {content.isPending && <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}
          {content.isSuccess && content.data.length === 0 && <p className="text-sm text-muted-foreground">No saved content yet.</p>}
          <div className="space-y-2">
            {content.data?.map((c) => {
              const Icon = KIND_ICON[c.kind] ?? Library;
              const busy = busyId === c.id;
              return (
                <Card key={c.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs uppercase text-muted-foreground">{c.kind}</div>
                      <div className="truncate">{c.title}</div>
                    </div>
                    {c.kind === "audio" && (
                      <Button size="icon" variant="ghost" onClick={() => play(c.id)} disabled={busy} title="Play">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => download(c)} disabled={busy} title="Download">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                  {audio?.id === c.id && <audio src={audio.src} controls autoPlay className="mt-2 w-full" />}
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
