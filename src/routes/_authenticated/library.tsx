import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { downloadDeck } from "@/lib/pptx-download";
import { audioSrcFor, downloadContent, fetchPayload } from "@/lib/content-actions";
import type { Deck } from "@/lib/pptx.functions";
import type { VideoPlan } from "@/lib/video.functions";
import { toast } from "sonner";
import {
  Library as LibraryIcon, Presentation, AudioLines, Video, Search, Trash2,
  Download, Loader2, MessageSquare, Play,
} from "lucide-react";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({ meta: [{ title: pageTitle("Library") }] }),
  component: LibraryPage,
});

type Item = {
  id: string;
  kind: string;
  title: string;
  prompt: string | null;
  status: string;
  created_at: string;
  thread_id: string | null;
  subject_id: string | null;
  subjects: { name: string; color: string } | null;
};

const KINDS = [
  { value: "all", label: "All" },
  { value: "powerpoint", label: "Presentations" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Videos" },
] as const;

const KIND_META: Record<string, { icon: typeof Presentation; label: string; tint: string }> = {
  powerpoint: { icon: Presentation, label: "Presentation", tint: "bg-orange-500/10 text-orange-600" },
  audio: { icon: AudioLines, label: "Audio", tint: "bg-pink-500/10 text-pink-600" },
  video: { icon: Video, label: "Video", tint: "bg-purple-500/10 text-purple-600" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function LibraryPage() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<string>("all");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [audio, setAudio] = useState<{ id: string; src: string } | null>(null);
  const [deckPreview, setDeckPreview] = useState<{ title: string; deck: Deck } | null>(null);
  const [planPreview, setPlanPreview] = useState<{ title: string; plan: VideoPlan } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);

  const items = useQuery({
    queryKey: ["library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_content")
        .select("id, kind, title, prompt, status, created_at, thread_id, subject_id, subjects(name, color)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Item[];
    },
  });

  const filtered = (items.data ?? []).filter((i) => {
    const matchesKind = kind === "all" || i.kind === kind;
    const needle = q.trim().toLowerCase();
    const matchesText = !needle || i.title.toLowerCase().includes(needle) || (i.prompt ?? "").toLowerCase().includes(needle);
    return matchesKind && matchesText;
  });

  async function open(item: Item) {
    setBusyId(item.id);
    try {
      if (item.kind === "audio") {
        setAudio({ id: item.id, src: await audioSrcFor(item.id) });
        return;
      }
      const payload = await fetchPayload(item.id);
      if (item.kind === "powerpoint") {
        setDeckPreview({ title: item.title, deck: payload as Deck });
      } else if (item.kind === "video") {
        setPlanPreview({ title: item.title, plan: payload as VideoPlan });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open this item");
    } finally {
      setBusyId(null);
    }
  }

  async function download(item: Item) {
    setBusyId(item.id);
    try {
      await downloadContent(item);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    const item = pendingDelete;
    setPendingDelete(null);
    if (!item) return;
    const { error } = await supabase.from("generated_content").delete().eq("id", item.id);
    if (error) return toast.error(error.message);
    if (audio?.id === item.id) setAudio(null);
    qc.invalidateQueries({ queryKey: ["library"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    toast.success("Deleted");
  }

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <h1 className="font-display text-4xl flex items-center gap-2"><LibraryIcon className="h-8 w-8" /> Library</h1>
        <p className="text-muted-foreground">Everything you've created, in one place.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <Tabs value={kind} onValueChange={setKind}>
          <TabsList>
            {KINDS.map((k) => <TabsTrigger key={k.value} value={k.value}>{k.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
          <Input placeholder="Search your work…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {items.isPending && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      )}

      {items.isError && (
        <Card className="p-6 text-sm text-destructive">Could not load your library. Please refresh the page.</Card>
      )}

      {items.isSuccess && filtered.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground space-y-3">
          <LibraryIcon className="h-8 w-8 mx-auto" />
          <p>{q || kind !== "all" ? "Nothing matches that filter." : "You haven't created anything yet."}</p>
          {!q && kind === "all" && (
            <div className="flex justify-center gap-2 flex-wrap pt-1">
              <Link to="/powerpoint"><Button size="sm" variant="outline">Make a presentation</Button></Link>
              <Link to="/audio"><Button size="sm" variant="outline">Record narration</Button></Link>
              <Link to="/video"><Button size="sm" variant="outline">Create a video</Button></Link>
            </div>
          )}
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((item) => {
          const meta = KIND_META[item.kind] ?? { icon: LibraryIcon, label: item.kind, tint: "bg-muted text-foreground" };
          const Icon = meta.icon;
          const busy = busyId === item.id;
          return (
            <Card key={item.id} className="p-4">
              <div className="flex items-start gap-4">
                <div className={`h-10 w-10 shrink-0 rounded-lg grid place-items-center ${meta.tint}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.title}</div>
                  <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-muted-foreground">
                    <span>{meta.label}</span>
                    <span>·</span>
                    <span>{formatDate(item.created_at)}</span>
                    {item.subjects && (
                      <Badge variant="outline" className="gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.subjects.color }} />
                        {item.subjects.name}
                      </Badge>
                    )}
                    {item.kind === "video" && item.status === "rendered" && <Badge variant="secondary">Rendered</Badge>}
                  </div>
                  {item.prompt && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.prompt}</p>}
                  {audio?.id === item.id && (
                    <audio src={audio.src} controls autoPlay className="mt-3 w-full max-w-md" />
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.thread_id && (
                    <Link to="/chat/$threadId" params={{ threadId: item.thread_id }}>
                      <Button size="icon" variant="ghost" title="Open the chat this came from">
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => open(item)} disabled={busy} title={item.kind === "audio" ? "Play" : "Open"}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : item.kind === "audio" ? <Play className="h-4 w-4" /> : <LibraryIcon className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => download(item)} disabled={busy} title="Download">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setPendingDelete(item)} title="Delete" className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={Boolean(deckPreview)} onOpenChange={(o) => !o && setDeckPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{deckPreview?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {deckPreview?.deck.slides?.map((s, i) => (
              <Card key={i} className="p-4">
                <div className="text-xs text-muted-foreground">Slide {i + 1}</div>
                <div className="font-semibold">{s.title}</div>
                <ul className="list-disc pl-5 text-sm mt-1 space-y-0.5">
                  {s.bullets?.map((b, bi) => <li key={bi}>{b}</li>)}
                </ul>
                {s.notes && <p className="text-xs text-muted-foreground mt-2 italic">{s.notes}</p>}
              </Card>
            ))}
            {deckPreview && (
              <Button onClick={() => downloadDeck(deckPreview.deck)} className="w-full">
                <Download className="h-4 w-4 mr-1" /> Download .pptx
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(planPreview)} onOpenChange={(o) => !o && setPlanPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{planPreview?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm whitespace-pre-wrap">{planPreview?.plan.script}</p>
            {planPreview?.plan.scenes?.map((s) => (
              <Card key={s.index} className="p-4 space-y-1">
                <div className="text-xs text-muted-foreground">Scene {s.index} · {s.duration}s</div>
                <div className="text-sm"><strong>Visual:</strong> {s.visual}</div>
                <div className="text-sm"><strong>Narration:</strong> {s.narration}</div>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
