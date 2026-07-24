import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MessageSquare, Plus, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/subjects/$subjectId")({
  head: () => ({ meta: [{ title: "Subject — LearnLab" }] }),
  component: SubjectDetail,
});

function SubjectDetail() {
  const { subjectId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

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
          {threads.data?.length === 0 && <p className="text-sm text-muted-foreground">No chats in this subject yet.</p>}
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
          <h2 className="font-semibold mb-3">Saved content</h2>
          {content.data?.length === 0 && <p className="text-sm text-muted-foreground">No saved content yet.</p>}
          <div className="space-y-2">
            {content.data?.map((c) => (
              <Card key={c.id} className="p-3 flex items-center justify-between">
                <div className="truncate">
                  <div className="text-xs uppercase text-muted-foreground">{c.kind}</div>
                  <div className="truncate">{c.title}</div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
