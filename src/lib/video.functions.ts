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
        payload: JSON.parse(JSON.stringify({ ...plan, duration: data.duration, aspectRatio: data.aspectRatio })),
        subject_id: data.subjectId ?? null,
        thread_id: data.threadId ?? null,
        status: "plan_ready",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: saved.id, plan };
  });

const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;

const AssetsInput = z.object({
  contentId: z.string().uuid().optional().nullable(),
  scenes: z
    .array(
      z.object({
        index: z.number().int().min(0),
        visual: z.string().min(1).max(800),
        narration: z.string().min(1).max(1500),
      }),
    )
    .min(1)
    .max(24),
  style: z.string().default("educational"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  voice: z.enum(VOICES).default("alloy"),
});

export type SceneAssetResult = {
  index: number;
  imageDataUrl?: string;
  audioBase64?: string;
  imageError?: string;
  audioError?: string;
};

/**
 * Produces the raw material for a video: one illustration and one narration
 * track per scene. Stitching happens in the browser (see video-composer.ts),
 * which avoids shipping a server-side encoder.
 */
export const generateSceneAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AssetsInput.parse(d))
  .handler(async ({ data, context }): Promise<{ results: SceneAssetResult[] }> => {
    const { generateImageDataUrl, ttsBase64 } = await import("./ai.server");
    const framing =
      data.aspectRatio === "9:16"
        ? "tall vertical 9:16 framing"
        : data.aspectRatio === "1:1"
          ? "square 1:1 framing"
          : "wide 16:9 framing";

    const queue = [...data.scenes];
    const results: SceneAssetResult[] = [];

    async function worker() {
      for (let scene = queue.shift(); scene; scene = queue.shift()) {
        const result: SceneAssetResult = { index: scene.index };
        try {
          result.imageDataUrl = await generateImageDataUrl(
            `${scene.visual}. ${data.style} style illustration for an educational video, ${framing}, cinematic lighting, no text or captions in the image.`,
          );
        } catch (err) {
          result.imageError = err instanceof Error ? err.message : "Image failed";
        }
        try {
          result.audioBase64 = await ttsBase64(scene.narration, data.voice);
        } catch (err) {
          result.audioError = err instanceof Error ? err.message : "Narration failed";
        }
        results.push(result);
      }
    }
    await Promise.all([worker(), worker()]);
    results.sort((a, b) => a.index - b.index);

    if (data.contentId) {
      await context.supabase
        .from("generated_content")
        .update({ status: "assets_ready" })
        .eq("id", data.contentId);
    }
    return { results };
  });
