import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateVideoPlan, generateSceneAssets, type VideoPlan } from "@/lib/video.functions";
import { composeVideo, isVideoRenderingSupported, type RenderProgress } from "@/lib/video-composer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Video, Loader2, Download, Film } from "lucide-react";
import { pageTitle } from "@/lib/brand";
import { z } from "zod";

const search = z.object({ from: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/video")({
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: pageTitle("Video") }] }),
  component: VideoPage,
});

const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;

function VideoPage() {
  const { from } = Route.useSearch();
  const send = useServerFn(generateVideoPlan);
  const sendAssets = useServerFn(generateSceneAssets);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(30);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [style, setStyle] = useState("educational");
  const [voice, setVoice] = useState<(typeof VOICES)[number]>("alloy");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<VideoPlan | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderStatus, setRenderStatus] = useState<string>("");
  const [renderPercent, setRenderPercent] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoExt, setVideoExt] = useState("webm");
  const objectUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!from) return;
    supabase
      .from("messages")
      .select("role, content")
      .eq("thread_id", from)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPrompt(data.content.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim().slice(0, 2000));
      });
  }, [from]);

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await send({ data: { prompt, duration, aspectRatio, style, threadId: from ?? null } });
      setPlan(res.plan);
      setPlanId(res.id);
      setVideoUrl(null);
      toast.success("Video plan ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setLoading(false); }
  }

  async function render() {
    if (!plan?.scenes?.length) return;
    if (!isVideoRenderingSupported()) {
      toast.error("Your browser can't record video. Try Chrome or Edge.");
      return;
    }
    setRendering(true);
    setRenderPercent(0);
    setVideoUrl(null);
    try {
      setRenderStatus("Creating pictures and narration for each scene…");
      const { results } = await sendAssets({
        data: {
          contentId: planId,
          scenes: plan.scenes.map((s) => ({ index: s.index, visual: s.visual, narration: s.narration })),
          style,
          aspectRatio,
          voice,
        },
      });
      const assetByIndex = new Map(results.map((r) => [r.index, r]));
      const missingAudio = results.filter((r) => !r.audioBase64).length;
      if (missingAudio === results.length) {
        throw new Error("Narration could not be generated, so there is nothing to record.");
      }
      setRenderPercent(35);

      const scenes = plan.scenes.map((s) => {
        const asset = assetByIndex.get(s.index);
        return {
          index: s.index,
          caption: s.caption,
          narration: s.narration,
          duration: s.duration,
          imageDataUrl: asset?.imageDataUrl,
          audioBase64: asset?.audioBase64,
        };
      });

      setRenderStatus("Recording your video — keep this tab open and visible.");
      const onProgress = (p: RenderProgress) => {
        if (p.stage === "recording") {
          setRenderStatus(`Recording scene ${p.sceneNumber} of ${p.sceneTotal}…`);
          const share = p.secondsTotal > 0 ? p.secondsDone / p.secondsTotal : 0;
          setRenderPercent(35 + Math.round(share * 60));
        } else if (p.stage === "finishing") {
          setRenderStatus("Finishing up…");
          setRenderPercent(97);
        }
      };

      const { blob, extension } = await composeVideo({
        title: plan.title,
        scenes,
        aspectRatio,
        onProgress,
      });

      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      const url = URL.createObjectURL(blob);
      objectUrl.current = url;
      setVideoUrl(url);
      setVideoExt(extension);
      setRenderPercent(100);
      if (planId) await supabase.from("generated_content").update({ status: "rendered" }).eq("id", planId);
      toast.success("Your video is ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rendering failed");
    } finally {
      setRendering(false);
      setRenderStatus("");
    }
  }

  function downloadVideo() {
    if (!videoUrl || !plan) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `${plan.title.replace(/[^\w]+/g, "_")}.${videoExt}`;
    a.click();
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <h1 className="font-display text-4xl flex items-center gap-2"><Video className="h-8 w-8" /> Video</h1>
        <p className="text-muted-foreground">Write a script, then turn it into a narrated video you can download.</p>
      </div>
      <Card className="p-5 space-y-3">
        <div><Label>Prompt</Label><Textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Create a 30-second educational video explaining photosynthesis…" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          <div>
            <Label>Narrator voice</Label>
            <Select value={voice} onValueChange={(v) => setVoice(v as typeof voice)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VOICES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
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
          <Card className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-semibold">{plan.title}</h2>
                <div className="text-xs text-muted-foreground mt-1">Music mood: {plan.musicMood}</div>
              </div>
              <Button onClick={render} disabled={rendering}>
                {rendering ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Rendering…</> : <><Film className="h-4 w-4 mr-1" /> Render video</>}
              </Button>
            </div>
            <div className="text-sm whitespace-pre-wrap">{plan.script}</div>
          </Card>

          {rendering && (
            <Card className="p-5 space-y-2">
              <Progress value={renderPercent} />
              <p className="text-sm text-muted-foreground">{renderStatus}</p>
              <p className="text-xs text-muted-foreground">
                Recording happens in real time, so this takes about as long as the video itself. Leave this tab in the
                foreground until it finishes.
              </p>
            </Card>
          )}

          {videoUrl && (
            <Card className="p-5 space-y-3">
              <h3 className="font-semibold">Your video</h3>
              <video src={videoUrl} controls className="w-full rounded-md border bg-black" />
              <Button variant="outline" onClick={downloadVideo}>
                <Download className="h-4 w-4 mr-1" /> Download .{videoExt}
              </Button>
            </Card>
          )}

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
        </div>
      )}
    </div>
  );
}
