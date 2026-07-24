import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useServerFn } from "@tanstack/react-start";
import { sendChatMessage } from "@/lib/chat.functions";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Plus, Send, Trash2, Pencil, Presentation, AudioLines, Video, Paperclip, ImageIcon, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({ meta: [{ title: "Chat — LearnLab" }] }),
  component: ChatView,
});

function ChatView() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [imageMode, setImageMode] = useState(false);
  const sendFn = useServerFn(sendChatMessage);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickFiles(files: FileList | null) {
    if (!files) return;
    const next: string[] = [];
    for (const f of Array.from(files).slice(0, 4 - images.length)) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 5 * 1024 * 1024) { toast.error(`${f.name} exceeds 5MB`); continue; }
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      next.push(dataUrl);
    }
    setImages((prev) => [...prev, ...next].slice(0, 4));
  }

  const threads = useQuery({
    queryKey: ["threads"],
    queryFn: async () => {
      const { data } = await supabase.from("threads").select("id, title, subject_id, pinned, updated_at, subjects(name, color)").order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const thread = useQuery({
    queryKey: ["thread", threadId],
    queryFn: async () => {
      const { data } = await supabase.from("threads").select("id, title, subject_id, subjects(name)").eq("id", threadId).single();
      return data;
    },
  });

  const messages = useQuery({
    queryKey: ["messages", threadId],
    queryFn: async () => {
      const { data } = await supabase.from("messages").select("id, role, content, created_at").eq("thread_id", threadId).order("created_at");
      return data ?? [];
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.data]);

  async function newChat() {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data, error } = await supabase.from("threads").insert({ user_id: user.user.id, title: "New chat" }).select("id").single();
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["threads"] });
    navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
  }

  async function deleteThread(id: string) {
    if (!confirm("Delete this chat?")) return;
    const { error } = await supabase.from("threads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["threads"] });
    if (id === threadId) navigate({ to: "/chat" });
  }

  async function renameThread(id: string) {
    const t = prompt("New title");
    if (!t) return;
    await supabase.from("threads").update({ title: t }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["threads"] });
    qc.invalidateQueries({ queryKey: ["thread", id] });
  }

  async function send() {
    const content = input.trim();
    if ((!content && images.length === 0) || sending) return;
    if (imageMode && !content) { toast.error("Describe the image to generate"); return; }
    const attached = images;
    const mode = imageMode ? "image" as const : "chat" as const;
    setInput("");
    setImages([]);
    setSending(true);
    const optimistic = attached.map((u) => `![attached image](${u})`).join("\n\n") + (attached.length && content ? "\n\n" : "") + content;
    qc.setQueryData<Array<{ id: string; role: string; content: string; created_at: string }>>(["messages", threadId], (old) => [
      ...(old ?? []),
      { id: "tmp-" + Date.now(), role: "user", content: optimistic, created_at: new Date().toISOString() },
    ]);
    try {
      await sendFn({ data: { threadId, content, images: attached, mode } });
      await qc.invalidateQueries({ queryKey: ["messages", threadId] });
      await qc.invalidateQueries({ queryKey: ["threads"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  const lastAssistant = messages.data?.filter((m) => m.role === "assistant").slice(-1)[0]?.content;

  return (
    <div className="flex h-screen">
      <aside className="hidden lg:flex w-72 flex-col border-r bg-card">
        <div className="p-3 border-b">
          <Button onClick={newChat} className="w-full" size="sm"><Plus className="h-4 w-4 mr-1" /> New chat</Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {threads.data?.map((t) => (
            <div key={t.id} className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-accent ${t.id === threadId ? "bg-accent" : ""}`}>
              <Link to="/chat/$threadId" params={{ threadId: t.id }} className="flex-1 truncate">
                {t.title}
                {(t as { subjects?: { name?: string } }).subjects?.name && (
                  <span className="ml-1 text-[10px] text-muted-foreground">· {(t as { subjects?: { name?: string } }).subjects?.name}</span>
                )}
              </Link>
              <button onClick={() => renameThread(t.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => deleteThread(t.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b p-4 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="font-semibold truncate">{thread.data?.title ?? "Chat"}</h1>
            {(thread.data as { subjects?: { name?: string } })?.subjects?.name && (
              <div className="text-xs text-muted-foreground">Subject: {(thread.data as { subjects?: { name?: string } }).subjects?.name}</div>
            )}
          </div>
          {lastAssistant && (
            <div className="flex gap-1">
              <Link to="/powerpoint" search={{ from: threadId }}><Button size="sm" variant="outline"><Presentation className="h-4 w-4 mr-1" /> To PPT</Button></Link>
              <Link to="/audio" search={{ from: threadId }}><Button size="sm" variant="outline"><AudioLines className="h-4 w-4 mr-1" /> To Audio</Button></Link>
              <Link to="/video" search={{ from: threadId }}><Button size="sm" variant="outline"><Video className="h-4 w-4 mr-1" /> To Video</Button></Link>
            </div>
          )}
        </header>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {messages.data?.length === 0 && (
            <div className="max-w-2xl mx-auto text-center text-muted-foreground py-16">
              <p className="text-lg">Ask anything to get started.</p>
            </div>
          )}
          {messages.data?.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <Card className={`p-4 max-w-[85%] ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                <div className="markdown">
                  <ReactMarkdown
                    components={{
                      img: ({ src, alt }) => (
                        <img src={src as string} alt={alt ?? ""} className="rounded-md max-w-full my-2 border" />
                      ),
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                </div>
              </Card>
            </div>
          ))}
          {sending && <div className="text-sm text-muted-foreground">{imageMode ? "Generating image…" : "Thinking…"}</div>}
        </div>
        <div className="border-t p-3 md:p-4">
          <div className="max-w-3xl mx-auto space-y-2">
            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {images.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} alt="" className="h-16 w-16 object-cover rounded border" />
                    <button
                      onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 bg-background border rounded-full p-0.5"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-end">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { onPickFiles(e.target.files); if (fileRef.current) fileRef.current.value = ""; }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileRef.current?.click()}
                disabled={sending || imageMode || images.length >= 4}
                title="Attach images to analyze"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={imageMode ? "default" : "outline"}
                size="icon"
                onClick={() => { setImageMode((v) => !v); if (!imageMode) setImages([]); }}
                disabled={sending}
                title="Toggle image generation mode"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={imageMode ? "Describe an image to generate…" : images.length ? "Ask about the attached image(s)…" : "Ask anything…"}
                rows={1}
                className="resize-none min-h-[44px]"
              />
              <Button onClick={send} disabled={sending || (!input.trim() && images.length === 0)}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
