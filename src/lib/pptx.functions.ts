import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  prompt: z.string().min(3).max(2000),
  slideCount: z.number().int().min(3).max(20).default(8),
  style: z.string().default("clean modern"),
  subjectId: z.string().uuid().optional().nullable(),
  threadId: z.string().uuid().optional().nullable(),
  contextText: z.string().max(20000).optional().nullable(),
});

export type Slide = {
  title: string;
  bullets: string[];
  notes: string;
  imageSuggestion?: string;
  /** Generated illustration, kept client-side only — never persisted to the database. */
  imageDataUrl?: string;
};
export type Deck = {
  title: string;
  slides: Slide[];
  references?: string[];
};

export const generateDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { chatCompletion } = await import("./ai.server");
    const sys = `You generate structured slide decks as JSON. Output ONLY valid JSON matching this TypeScript type:
{ "title": string, "slides": Array<{ "title": string, "bullets": string[], "notes": string, "imageSuggestion"?: string }>, "references"?: string[] }
Rules: Include a title slide and a conclusion slide. 3-6 concise bullets per slide (max ~12 words). Speaker notes 1-3 sentences. Total slides: ${data.slideCount}. Style: ${data.style}.`;
    const user = `Create a presentation about: ${data.prompt}${data.contextText ? `\n\nUse this context:\n${data.contextText}` : ""}`;

    const raw = await chatCompletion(
      [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      { json: true },
    );
    let deck: Deck;
    try {
      deck = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned invalid JSON");
      deck = JSON.parse(m[0]);
    }
    if (!deck.slides?.length) throw new Error("AI produced no slides");

    const { supabase, userId } = context;
    const { data: saved, error } = await supabase
      .from("generated_content")
      .insert({
        user_id: userId,
        kind: "powerpoint",
        title: deck.title,
        prompt: data.prompt,
        payload: JSON.parse(JSON.stringify(deck)),
        subject_id: data.subjectId ?? null,
        thread_id: data.threadId ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: saved.id, deck };
  });

const ImagesInput = z.object({
  slides: z
    .array(z.object({ index: z.number().int().min(0), prompt: z.string().min(3).max(600) }))
    .min(1)
    .max(20),
  style: z.string().default("clean modern"),
});

export type SlideImageResult =
  | { index: number; dataUrl: string }
  | { index: number; error: string };

export const generateSlideImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ImagesInput.parse(d))
  .handler(async ({ data }): Promise<{ results: SlideImageResult[] }> => {
    const { generateImageDataUrl } = await import("./ai.server");
    const queue = [...data.slides];
    const results: SlideImageResult[] = [];

    // Two at a time keeps us well under the gateway's rate limit on larger decks.
    async function worker() {
      for (let job = queue.shift(); job; job = queue.shift()) {
        try {
          const dataUrl = await generateImageDataUrl(
            `${job.prompt}. Educational illustration in a ${data.style} style. Clean composition, wide 16:9 framing, no text or captions in the image.`,
          );
          results.push({ index: job.index, dataUrl });
        } catch (err) {
          results.push({ index: job.index, error: err instanceof Error ? err.message : "Image failed" });
        }
      }
    }
    await Promise.all([worker(), worker()]);

    results.sort((a, b) => a.index - b.index);
    return { results };
  });
