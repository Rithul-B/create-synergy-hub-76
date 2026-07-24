import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({ meta: [{ title: "Chat — LearnLab" }] }),
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { data: existing } = await supabase
        .from("threads")
        .select("id")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        navigate({ to: "/chat/$threadId", params: { threadId: existing.id }, replace: true });
        return;
      }
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      const { data: created, error } = await supabase
        .from("threads")
        .insert({ user_id: user.user.id, title: "New chat" })
        .select("id")
        .single();
      if (error) { toast.error(error.message); return; }
      navigate({ to: "/chat/$threadId", params: { threadId: created.id }, replace: true });
    })();
  }, [navigate]);
  return <div className="p-10 text-muted-foreground">Opening chat…</div>;
}
