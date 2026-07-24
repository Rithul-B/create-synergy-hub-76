import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateDeck, type Deck } from "@/lib/pptx.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Download, Presentation, Trash2, Plus } from "lucide-react";
import { z } from "zod";

const search = z.object({ from: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/powerpoint")({
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: "PowerPoint — LearnLab" }] }),
  component: PowerPointPage,
});

function PowerPointPage() {
  const { from } = Route.useSearch();
  const send = useServerFn(generateDeck);
  const [prompt, setPrompt] = useState("");
  const [slideCount, setSlideCount] = useState(8);
  const [style, setStyle] = useState("clean modern");
  const [loading, setLoading] = useState(false);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [contextText, setContextText] = useState<string>("");

  useEffect(() => {
    supabase.from("subjects").select("id, name").then(({ data }) => setSubjects(data ?? []));
    if (from) {
      supabase.from("messages").select("role, content").eq("thread_id", from).order("created_at").then(({ data }) => {
        const text = (data ?? []).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n").slice(-8000);
        setContextText(text);
        const last = (data ?? []).filter((m) => m.role === "user")[0]?.content;
        if (last) setPrompt(last);
      });
    }
  }, [from]);

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await send({ data: { prompt, slideCount, style, subjectId: subjectId || null, threadId: from ?? null, contextText: contextText || null } });
      setDeck(res.deck);
      setDeckId(res.id);
      toast.success("Deck generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setLoading(false); }
  }

  async function download() {
    if (!deck) return;
    const pptxgen = (await import("pptxgenjs")).default;
    const pres = new pptxgen();
    pres.title = deck.title;
    pres.layout = "LAYOUT_WIDE";
    deck.slides.forEach((slide, i) => {
      const s = pres.addSlide();
      s.background = { color: i === 0 ? "1E1B4B" : "FFFFFF" };
      const isTitle = i === 0;
      s.addText(slide.title, {
        x: 0.5, y: isTitle ? 2.5 : 0.4, w: 12.3, h: isTitle ? 1.5 : 0.9,
        fontSize: isTitle ? 44 : 32, bold: true,
        color: isTitle ? "FFFFFF" : "1E1B4B", fontFace: "Calibri",
      });
      if (slide.bullets?.length && !isTitle) {
        s.addText(slide.bullets.map((b) => ({ text: b, options: { bullet: true } })), {
          x: 0.5, y: 1.6, w: 12.3, h: 5.2, fontSize: 22, color: "333333", fontFace: "Calibri", paraSpaceAfter: 10,
        });
      } else if (slide.bullets?.length && isTitle) {
        s.addText(slide.bullets.join(" • "), { x: 0.5, y: 4.2, w: 12.3, h: 0.7, fontSize: 20, color: "C7D2FE", align: "center" });
      }
      if (slide.notes) s.addNotes(slide.notes);
    });
    await pres.writeFile({ fileName: `${deck.title.replace(/[^\w]+/g, "_")}.pptx` });
  }

  function updateSlide(idx: number, patch: Partial<{ title: string; bullets: string[]; notes: string }>) {
    if (!deck) return;
    const next = { ...deck, slides: deck.slides.map((s, i) => (i === idx ? { ...s, ...patch } : s)) };
    setDeck(next);
    if (deckId) supabase.from("generated_content").update({ payload: JSON.parse(JSON.stringify(next)) }).eq("id", deckId);
  }

  function addSlide() {
    if (!deck) return;
    const next = { ...deck, slides: [...deck.slides, { title: "New slide", bullets: ["Add content"], notes: "" }] };
    setDeck(next);
    if (deckId) supabase.from("generated_content").update({ payload: JSON.parse(JSON.stringify(next)) }).eq("id", deckId);
  }
  function removeSlide(idx: number) {
    if (!deck) return;
    const next = { ...deck, slides: deck.slides.filter((_, i) => i !== idx) };
    setDeck(next);
    if (deckId) supabase.from("generated_content").update({ payload: JSON.parse(JSON.stringify(next)) }).eq("id", deckId);
  }

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <h1 className="font-display text-4xl flex items-center gap-2"><Presentation className="h-8 w-8" /> PowerPoint</h1>
        <p className="text-muted-foreground">Generate a deck, preview it, edit slides, and download as .pptx.</p>
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
                <SelectItem value="">None</SelectItem>
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
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">{deck.title}</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={addSlide}><Plus className="h-4 w-4 mr-1" /> Add slide</Button>
              <Button onClick={download}><Download className="h-4 w-4 mr-1" /> Download .pptx</Button>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {deck.slides.map((s, i) => (
              <Card key={i} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Slide {i + 1}</span>
                  <button onClick={() => removeSlide(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
                <Input value={s.title} onChange={(e) => updateSlide(i, { title: e.target.value })} className="font-semibold" />
                <Textarea rows={4} value={s.bullets.join("\n")} onChange={(e) => updateSlide(i, { bullets: e.target.value.split("\n").filter(Boolean) })} placeholder="One bullet per line" />
                <Textarea rows={2} value={s.notes} onChange={(e) => updateSlide(i, { notes: e.target.value })} placeholder="Speaker notes" className="text-xs" />
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
