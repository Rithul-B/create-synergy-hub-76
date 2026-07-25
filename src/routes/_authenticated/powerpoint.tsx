import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateDeck, generateSlideImages, type Deck } from "@/lib/pptx.functions";
import { downloadDeck } from "@/lib/pptx-download";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Download, Presentation, Trash2, Plus, ImageIcon, X } from "lucide-react";
import { pageTitle } from "@/lib/brand";
import { z } from "zod";

const search = z.object({ from: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/powerpoint")({
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: pageTitle("Slides") }] }),
  component: PowerPointPage,
});

/** Radix selects reject empty string values, so "no subject" needs a sentinel. */
const NO_SUBJECT = "none";

/** Images are large base64 blobs — keep them out of the saved payload. */
function withoutImages(deck: Deck): Deck {
  return { ...deck, slides: deck.slides.map(({ imageDataUrl: _drop, ...rest }) => rest) };
}

function PowerPointPage() {
  const { from } = Route.useSearch();
  const send = useServerFn(generateDeck);
  const sendImages = useServerFn(generateSlideImages);
  const [prompt, setPrompt] = useState("");
  const [slideCount, setSlideCount] = useState(8);
  const [style, setStyle] = useState("clean modern");
  const [loading, setLoading] = useState(false);
  const [imaging, setImaging] = useState(false);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [subjectId, setSubjectId] = useState<string>(NO_SUBJECT);
  const [contextText, setContextText] = useState<string>("");

  useEffect(() => {
    supabase.from("subjects").select("id, name").then(({ data }) => setSubjects(data ?? []));
    if (from) {
      supabase.from("messages").select("role, content").eq("thread_id", from).order("created_at").then(({ data }) => {
        const all = data ?? [];
        setContextText(all.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n").slice(-8000));
        const latestQuestion = all.filter((m) => m.role === "user").slice(-1)[0]?.content;
        if (latestQuestion) setPrompt(latestQuestion.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim().slice(0, 2000));
      });
    }
  }, [from]);

  function persist(next: Deck) {
    setDeck(next);
    if (deckId) {
      supabase
        .from("generated_content")
        .update({ payload: JSON.parse(JSON.stringify(withoutImages(next))) })
        .eq("id", deckId);
    }
  }

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await send({
        data: {
          prompt, slideCount, style,
          subjectId: subjectId === NO_SUBJECT ? null : subjectId,
          threadId: from ?? null,
          contextText: contextText || null,
        },
      });
      setDeck(res.deck);
      setDeckId(res.id);
      toast.success("Deck generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setLoading(false); }
  }

  async function addImages() {
    if (!deck) return;
    // Skip the title slide and anything that already has a picture.
    const targets = deck.slides
      .map((s, index) => ({ index, prompt: s.imageSuggestion?.trim() || s.title, has: Boolean(s.imageDataUrl) }))
      .filter((s) => s.index > 0 && !s.has);
    if (targets.length === 0) {
      toast.info("Every slide already has an image");
      return;
    }
    setImaging(true);
    try {
      const { results } = await sendImages({
        data: { slides: targets.map(({ index, prompt: p }) => ({ index, prompt: p })), style },
      });
      const byIndex = new Map(results.map((r) => [r.index, r]));
      const next = {
        ...deck,
        slides: deck.slides.map((s, i) => {
          const r = byIndex.get(i);
          return r && "dataUrl" in r ? { ...s, imageDataUrl: r.dataUrl } : s;
        }),
      };
      setDeck(next);
      const failed = results.filter((r) => "error" in r).length;
      if (failed === results.length) toast.error("Could not generate images");
      else if (failed > 0) toast.warning(`Added ${results.length - failed} images, ${failed} failed`);
      else toast.success(`Added ${results.length} images`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image generation failed");
    } finally { setImaging(false); }
  }

  async function download() {
    if (!deck) return;
    await downloadDeck(deck);
  }

  function updateSlide(idx: number, patch: Partial<{ title: string; bullets: string[]; notes: string; imageDataUrl?: string }>) {
    if (!deck) return;
    persist({ ...deck, slides: deck.slides.map((s, i) => (i === idx ? { ...s, ...patch } : s)) });
  }

  function removeImage(idx: number) {
    if (!deck) return;
    persist({
      ...deck,
      slides: deck.slides.map((s, i) => (i === idx ? { ...s, imageDataUrl: undefined } : s)),
    });
  }

  function addSlide() {
    if (!deck) return;
    persist({ ...deck, slides: [...deck.slides, { title: "New slide", bullets: ["Add content"], notes: "" }] });
  }
  function removeSlide(idx: number) {
    if (!deck) return;
    persist({ ...deck, slides: deck.slides.filter((_, i) => i !== idx) });
  }

  const imageCount = deck?.slides.filter((s) => s.imageDataUrl).length ?? 0;

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <h1 className="font-display text-4xl flex items-center gap-2"><Presentation className="h-8 w-8" /> PowerPoint</h1>
        <p className="text-muted-foreground">Generate a deck, add illustrations, edit slides, and download as .pptx.</p>
      </div>
      <Card className="p-5 space-y-3">
        <div>
          <Label>Prompt</Label>
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="Create a presentation about renewable energy for high school students…" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <Label>Slides</Label>
            <Input type="number" min={3} max={20} value={slideCount} onChange={(e) => setSlideCount(Number(e.target.value))} />
          </div>
          <div>
            <Label>Style</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clean modern">Clean modern</SelectItem>
                <SelectItem value="academic">Academic</SelectItem>
                <SelectItem value="corporate">Corporate</SelectItem>
                <SelectItem value="playful">Playful</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subject (optional)</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SUBJECT}>None</SelectItem>
                {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={generate} disabled={loading || !prompt.trim()}>
            {loading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating…</> : "Generate deck"}
          </Button>
        </div>
      </Card>
      {deck && (
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-2 flex-wrap">
            <h2 className="text-xl font-semibold">{deck.title}</h2>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={addImages} disabled={imaging}>
                {imaging ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Illustrating…</> : <><ImageIcon className="h-4 w-4 mr-1" /> Add AI images</>}
              </Button>
              <Button variant="outline" onClick={addSlide}><Plus className="h-4 w-4 mr-1" /> Add slide</Button>
              <Button onClick={download}><Download className="h-4 w-4 mr-1" /> Download .pptx</Button>
            </div>
          </div>
          {imageCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {imageCount} slide{imageCount === 1 ? "" : "s"} illustrated. Images live in this tab only — download the deck to keep them.
            </p>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            {deck.slides.map((s, i) => (
              <Card key={i} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Slide {i + 1}</span>
                  <button onClick={() => removeSlide(i)} className="text-muted-foreground hover:text-destructive" aria-label={`Delete slide ${i + 1}`}><Trash2 className="h-4 w-4" /></button>
                </div>
                <Input value={s.title} onChange={(e) => updateSlide(i, { title: e.target.value })} className="font-semibold" />
                <Textarea rows={4} value={s.bullets.join("\n")} onChange={(e) => updateSlide(i, { bullets: e.target.value.split("\n").filter(Boolean) })} placeholder="One bullet per line" />
                {s.imageDataUrl && (
                  <div className="relative">
                    <img src={s.imageDataUrl} alt="" className="rounded-md border w-full object-cover max-h-40" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 bg-background/90 border rounded-full p-1"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <Textarea rows={2} value={s.notes} onChange={(e) => updateSlide(i, { notes: e.target.value })} placeholder="Speaker notes" className="text-xs" />
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
