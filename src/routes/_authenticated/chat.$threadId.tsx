import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { sendChatMessage } from "@/lib/chat.functions";
import { createStudyPack, type StudyPack } from "@/lib/studypack.functions";
import { downloadDeck } from "@/lib/pptx-download";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Plus, Send, Trash2, Pencil, Presentation, AudioLines, Video, Paperclip,
  ImageIcon, X, Menu, Sparkles, Loader2, Download, Library,
} from "lucide-react";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({ meta: [{ title: pageTitle("AI Tutor") }] }),
  component: ChatView,
});

const NO_SUBJECT = "none";
const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;

type ThreadRow = {
  id: string;
  title: string;
  subject_id: string | null;
  subjects?: { name?: string; color?: string } | null;
};
type MessageRow = { id: string; role: string; content: string; created_at: string };

function ChatView() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [imageMode, setImageMode] = useState(false);
  const [threadListOpen, setThreadListOpen] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [packOpen, setPackOpen] = useState(false);
  const [packVoice, setPackVoice] = useState<(typeof VOICES)[number]>("alloy");
  const [packSlides, setPackSlides] = useState(8);
  const [packBusy, setPackBusy] = useState(false);
  const [pack, setPack] = useState<StudyPack | null>(null);
  const sendFn = useServerFn(sendChatMessage);
  const packFn = useServerFn(createStudyPack);
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
      const { data } = await supabase
        .from("threads")
        .select("id, title, subject_id, pinned, updated_at, subjects(name, color)")
        .order("updated_at", { ascending: false });
      return (data ?? []) as unknown as ThreadRow[];
    },
  });

  const thread = useQuery({
    queryKey: ["thread", threadId],
    queryFn: async () => {
      const { data } = await supabase.from("threads").select("id, title, subject_id, subjects(name)").eq("id", threadId).single();
      return data as unknown as ThreadRow | null;
    },
  });

  const subjects = useQuery({
    queryKey: ["subjects-brief"],
    queryFn: async () => {
      const { data } = await supabase.from("subjects").select("id, name").order("name");
      return data ?? [];
    },
  });

  const messages = useQuery({
    queryKey: ["messages", threadId],
    queryFn: async () => {
      const { data } = await supabase.from("messages").select("id, role, content, created_at").eq("thread_id", threadId).order("created_at");
      return (data ?? []) as MessageRow[];
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
    setThreadListOpen(false);
    navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
  }

  async function confirmDelete() {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    const { error } = await supabase.from("threads").delete().eq("id", target.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["threads"] });
    if (target.id === threadId) navigate({ to: "/chat" });
  }

  async function saveRename() {
    const target = renaming;
    setRenaming(null);
    if (!target?.title.trim()) return;
    const { error } = await supabase.from("threads").update({ title: target.title.trim() }).eq("id", target.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["threads"] });
    qc.invalidateQueries({ queryKey: ["thread", target.id] });
  }

  async function assignSubject(value: string) {
    const subjectId = value === NO_SUBJECT ? null : value;
    const { error } = await supabase.from("threads").update({ subject_id: subjectId }).eq("id", threadId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["thread", threadId] });
    qc.invalidateQueries({ queryKey: ["threads"] });
    toast.success(subjectId ? "Chat filed under subject" : "Removed from subject");
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

    const key = ["messages", threadId];
    const previous = qc.getQueryData<MessageRow[]>(key);
    const optimistic =
      attached.map((u) => `![attached image](${u})`).join("\n\n") +
      (attached.length && content ? "\n\n" : "") +
      content;
    qc.setQueryData<MessageRow[]>(key, (old) => [
      ...(old ?? []),
      { id: "tmp-" + Date.now(), role: "user", content: optimistic, created_at: new Date().toISOString() },
    ]);

    try {
      await sendFn({ data: { threadId, content, images: attached, mode } });
      await qc.invalidateQueries({ queryKey: key });
      await qc.invalidateQueries({ queryKey: ["threads"] });
    } catch (err) {
      // Put the draft back so nothing is lost, and drop the pending bubble.
      qc.setQueryData<MessageRow[]>(key, previous ?? []);
      setInput(content);
      setImages(attached);
      setImageMode(mode === "image");
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function buildPack() {
    setPackBusy(true);
    setPack(null);
    try {
      const result = await packFn({ data: { threadId, slideCount: packSlides, voice: packVoice, videoDuration: 45 } });
      setPack(result);
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      if (result.failures.length) toast.warning(`Study pack ready, with ${result.failures.length} part(s) missing`);
      else toast.success("Study pack ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not build study pack");
    } finally {
      setPackBusy(false);
    }
  }

  const hasAssistantReply = messages.data?.some((m) => m.role === "assistant") ?? false;

  const threadList = (
    <>
      <div className="p-3 border-b">
        <Button onClick={newChat} className="w-full" size="sm"><Plus className="h-4 w-4 mr-1" /> New chat</Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {threads.isPending && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
        {threads.data?.map((t) => (
          <div key={t.id} className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-accent ${t.id === threadId ? "bg-accent" : ""}`}>
            <Link
              to="/chat/$threadId"
              params={{ threadId: t.id }}
              onClick={() => setThreadListOpen(false)}
              className="flex-1 truncate"
            >
              {t.title}
              {t.subjects?.name && <span className="ml-1 text-[10px] text-muted-foreground">· {t.subjects.name}</span>}
            </Link>
            <button
              onClick={() => setRenaming({ id: t.id, title: t.title })}
              className="text-muted-foreground hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
              aria-label={`Rename ${t.title}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setPendingDelete({ id: t.id, title: t.title })}
              className="text-muted-foreground hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
              aria-label={`Delete ${t.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="flex h-screen">
      <aside className="hidden lg:flex w-72 flex-col border-r bg-card">{threadList}</aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b p-3 md:p-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sheet open={threadListOpen} onOpenChange={setThreadListOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button size="icon" variant="ghost" aria-label="All chats"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80 flex flex-col">
                <SheetHeader className="p-3 pb-0"><SheetTitle>Your chats</SheetTitle></SheetHeader>
                {threadList}
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <h1 className="font-semibold truncate">{thread.data?.title ?? "Chat"}</h1>
              <Select value={thread.data?.subject_id ?? NO_SUBJECT} onValueChange={assignSubject}>
                <SelectTrigger className="h-7 text-xs border-none px-0 shadow-none focus:ring-0 text-muted-foreground w-auto gap-1">
                  <SelectValue placeholder="No subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SUBJECT}>No subject</SelectItem>
                  {subjects.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {hasAssistantReply && (
            <div className="flex gap-1 flex-wrap justify-end">
              <Button size="sm" onClick={() => { setPack(null); setPackOpen(true); }}>
                <Sparkles className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Study pack</span>
              </Button>
              <Link to="/powerpoint" search={{ from: threadId }}>
                <Button size="sm" variant="outline"><Presentation className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">To PPT</span></Button>
              </Link>
              <Link to="/audio" search={{ from: threadId }}>
                <Button size="sm" variant="outline"><AudioLines className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">To Audio</span></Button>
              </Link>
              <Link to="/video" search={{ from: threadId }}>
                <Button size="sm" variant="outline"><Video className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">To Video</span></Button>
              </Link>
            </div>
          )}
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {messages.isPending && (
            <div className="max-w-2xl mx-auto space-y-4">
              <Skeleton className="h-16 w-2/3 ml-auto" />
              <Skeleton className="h-24 w-3/4" />
            </div>
          )}
          {messages.isSuccess && messages.data.length === 0 && (
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

      <Dialog open={renaming !== null} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Rename chat</DialogTitle></DialogHeader>
          <Input
            value={renaming?.title ?? ""}
            onChange={(e) => setRenaming((r) => (r ? { ...r, title: e.target.value } : r))}
            onKeyDown={(e) => { if (e.key === "Enter") saveRename(); }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button onClick={saveRename} disabled={!renaming?.title.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>Every message in this chat will be removed. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={packOpen} onOpenChange={(o) => { setPackOpen(o); if (!o) setPack(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create a study pack</DialogTitle></DialogHeader>
          {!pack ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Turns this whole conversation into a slide deck, a narrated summary you can listen to, and a video plan —
                all saved to your library.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Slides</Label>
                  <Input type="number" min={3} max={20} value={packSlides} onChange={(e) => setPackSlides(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Narrator voice</Label>
                  <Select value={packVoice} onValueChange={(v) => setPackVoice(v as typeof packVoice)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VOICES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={buildPack} disabled={packBusy} className="w-full">
                  {packBusy
                    ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Building — this takes a minute…</>
                    : <><Sparkles className="h-4 w-4 mr-1" /> Build study pack</>}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Saved to your library. Here's what you got:</p>
              {pack.deck && (
                <Card className="p-3 flex items-center gap-3">
                  <Presentation className="h-4 w-4 text-orange-600 shrink-0" />
                  <span className="flex-1 truncate text-sm">{pack.deck.title}</span>
                  <Button size="sm" variant="outline" onClick={() => downloadDeck(pack.deck!.value)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </Card>
              )}
              {pack.audio && (
                <Card className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <AudioLines className="h-4 w-4 text-pink-600 shrink-0" />
                    <span className="flex-1 truncate text-sm">{pack.audio.title}</span>
                  </div>
                  <audio controls src={`data:audio/mp3;base64,${pack.audio.base64}`} className="w-full" />
                </Card>
              )}
              {pack.video && (
                <Card className="p-3 flex items-center gap-3">
                  <Video className="h-4 w-4 text-purple-600 shrink-0" />
                  <span className="flex-1 truncate text-sm">{pack.video.title}</span>
                  <Link to="/video" search={{ from: threadId }} onClick={() => setPackOpen(false)}>
                    <Button size="sm" variant="outline">Render</Button>
                  </Link>
                </Card>
              )}
              {pack.failures.length > 0 && (
                <ul className="text-xs text-muted-foreground list-disc pl-5">
                  {pack.failures.map((f) => <li key={f}>{f}</li>)}
                </ul>
              )}
              <DialogFooter>
                <Link to="/library" onClick={() => setPackOpen(false)} className="w-full">
                  <Button variant="outline" className="w-full"><Library className="h-4 w-4 mr-1" /> Open library</Button>
                </Link>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
