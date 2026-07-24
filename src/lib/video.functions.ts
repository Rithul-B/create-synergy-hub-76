import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  prompt: z.string().min(3).max(2000),
  duration: z.number().int().min(10).max(120).default(30),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  style: z.string().default("educational"),
  subjectId: z.string().uuid().optional().nullable(),
  threadId: z.string().uuid().optional().nullable(),
});

export type VideoScene = {
  index: number;
  duration: number;
  visual: string;
  narration: string;
  caption: string;
};
export type VideoPlan = {
  title: string;
  script: string;
  scenes: VideoScene[];
  musicMood: string;
};

export const generateVideoPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { chatCompletion } = await import("./ai.server");
    const sys = `You are a video producer. Output ONLY valid JSON matching:
{ "title": string, "script": string, "scenes": Array<{ "index": number, "duration": number, "visual": string, "narration": string, "caption": string }>, "musicMood": string }
Design a ${data.duration}-second ${data.style} video, aspect ratio ${data.aspectRatio}. Break into scenes of ~5-8s each summing to ${data.duration}s. Narration should be natural, spoken text.`;
    const raw = await chatCompletion(
      [
        { role: "system", content: sys },
        { role: "user", content: `Video topic: ${data.prompt}` },
      ],
      { json: true },
    );
    let plan: VideoPlan;
    try { plan = JSON.parse(raw); } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned invalid JSON");
      plan = JSON.parse(m[0]);
    }
    const { supabase, userId } = context;
    const { data: saved, error } = await supabase
      .from("generated_content")
      .insert({
        user_id: userId,
        kind: "video",
        title: plan.title,
        prompt: data.prompt,
        payload: { ...plan, duration: data.duration, aspectRatio: data.aspectRatio } as unknown as Record<string, unknown>,
        subject_id: data.subjectId ?? null,
        thread_id: data.threadId ?? null,
        status: "plan_ready",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: saved.id, plan };
  });
