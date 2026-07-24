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
        payload: deck as unknown as Record<string, unknown>,
        subject_id: data.subjectId ?? null,
        thread_id: data.threadId ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: saved.id, deck };
  });
