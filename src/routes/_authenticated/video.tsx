import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateVideoPlan, type VideoPlan } from "@/lib/video.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Video, Loader2, Play } from "lucide-react";
import { z } from "zod";

const search = z.object({ from: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/video")({
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: "Video — LearnLab" }] }),
  component: VideoPage,
});

function VideoPage() {
  const { from } = Route.useSearch();
  const send = useServerFn(generateVideoPlan);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(30);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [style, setStyle] = useState("educational");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<VideoPlan | null>(null);

  useEffect(() => {
    if (from) {
      supabase.from("messages").select("role, content").eq("thread_id", from).eq("role", "user").order("created_at").limit(1).maybeSingle().then(({ data }) => {
        if (data) setPrompt(data.content);
      });
    }
  }, [from]);

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await send({ data: { prompt, duration, aspectRatio, style, threadId: from ?? null } });
      setPlan(res.plan);
      toast.success("Video plan ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <h1 className="font-display text-4xl flex items-center gap-2"><Video className="h-8 w-8" /> Video</h1>
        <p className="text-muted-foreground">Generate a full script and scene plan for a short video.</p>
      </div>
      <Card className="p-5 space-y-3">
        <div><Label>Prompt</Label><Textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Create a 30-second educational video explaining photosynthesis…" /></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><Label>Duration (s)</Label><Input type="number" min={10} max={120} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></div>
          <div>
            <Label>Aspect</Label>
            <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as typeof aspectRatio)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9</SelectItem>
                <SelectItem value="9:16">9:16 (vertical)</SelectItem>
                <SelectItem value="1:1">1:1 (square)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Style</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="educational">Educational</SelectItem>
                <SelectItem value="cinematic">Cinematic</SelectItem>
                <SelectItem value="documentary">Documentary</SelectItem>
                <SelectItem value="explainer">Explainer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={generate} disabled={loading || !prompt.trim()}>
            {loading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Planning…</> : "Generate plan"}
          </Button>
        </div>
      </Card>
      {plan && (
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-xl font-semibold">{plan.title}</h2>
            <div className="text-xs text-muted-foreground mt-1">Music mood: {plan.musicMood}</div>
            <div className="mt-3 text-sm whitespace-pre-wrap">{plan.script}</div>
          </Card>
          <div className="grid md:grid-cols-2 gap-3">
            {plan.scenes.map((s) => (
              <Card key={s.index} className="p-4 space-y-1">
                <div className="text-xs text-muted-foreground">Scene {s.index} · {s.duration}s</div>
                <div className="text-sm"><strong>Visual:</strong> {s.visual}</div>
                <div className="text-sm"><strong>Narration:</strong> {s.narration}</div>
                <div className="text-xs text-muted-foreground"><strong>Caption:</strong> {s.caption}</div>
              </Card>
            ))}
          </div>
          <Card className="p-4 text-sm text-muted-foreground flex items-center gap-2">
            <Play className="h-4 w-4" />
            Rendered video output is coming soon. For now, you have a full script and scene plan — perfect for narrating with the Audio tool.
          </Card>
        </div>
      )}
    </div>
  );
}
