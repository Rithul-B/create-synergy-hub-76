import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateAudio } from "@/lib/audio.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AudioLines, Download, Loader2 } from "lucide-react";
import { pageTitle } from "@/lib/brand";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

const search = z.object({ from: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/audio")({
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: pageTitle("Audio") }] }),
  component: AudioPage,
});

function AudioPage() {
  const { from } = Route.useSearch();
  const send = useServerFn(generateAudio);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [title, setTitle] = useState("Untitled audio");
  const [voice, setVoice] = useState<"alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer">("alloy");
  const [loading, setLoading] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);

  useEffect(() => {
    if (from) {
      supabase.from("messages").select("role, content").eq("thread_id", from).eq("role", "assistant").order("created_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
        if (data) setText(data.content.replace(/[#*_`>]/g, "").slice(0, 4000));
      });
    }
  }, [from]);

  const saved = useQuery({
    queryKey: ["saved-audio"],
    queryFn: async () => {
      const { data } = await supabase.from("generated_content").select("id, title, payload, created_at").eq("kind", "audio").order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  async function generate() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await send({ data: { text, voice, title } });
      setAudioBase64(res.audioBase64);
      toast.success("Audio generated");
      qc.invalidateQueries({ queryKey: ["saved-audio"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setLoading(false); }
  }

  function download(b64: string, name: string) {
    const a = document.createElement("a");
    a.href = `data:audio/mp3;base64,${b64}`;
    a.download = `${name.replace(/[^\w]+/g, "_")}.mp3`;
    a.click();
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <h1 className="font-display text-4xl flex items-center gap-2"><AudioLines className="h-8 w-8" /> Audio</h1>
        <p className="text-muted-foreground">Turn text into natural narration.</p>
      </div>
      <Card className="p-5 space-y-3">
        <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><Label>Text</Label><Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Enter text to narrate…" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Voice</Label>
            <Select value={voice} onValueChange={(v) => setVoice(v as typeof voice)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["alloy", "echo", "fable", "onyx", "nova", "shimmer"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={generate} disabled={loading || !text.trim()}>
            {loading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating…</> : "Generate audio"}
          </Button>
        </div>
        {audioBase64 && (
          <div className="flex items-center gap-3 pt-3 border-t">
            <audio controls src={`data:audio/mp3;base64,${audioBase64}`} className="flex-1" />
            <Button size="sm" variant="outline" onClick={() => download(audioBase64, title)}><Download className="h-4 w-4" /></Button>
          </div>
        )}
      </Card>
      {(saved.data?.length ?? 0) > 0 && (
        <div>
          <h2 className="font-semibold mb-2">Recent</h2>
          <div className="space-y-2">
            {saved.data!.map((s) => {
              const b64 = (s.payload as { audioBase64?: string }).audioBase64;
              return (
                <Card key={s.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1 truncate">{s.title}</div>
                  {b64 && <audio controls src={`data:audio/mp3;base64,${b64}`} className="h-8" />}
                  {b64 && <Button size="sm" variant="outline" onClick={() => download(b64, s.title)}><Download className="h-4 w-4" /></Button>}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
