import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  text: z.string().min(1).max(8000),
  voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).default("alloy"),
  title: z.string().max(120).default("Untitled audio"),
  subjectId: z.string().uuid().optional().nullable(),
  threadId: z.string().uuid().optional().nullable(),
});

export const generateAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { ttsBase64 } = await import("./ai.server");
    const audioBase64 = await ttsBase64(data.text, data.voice);
    const { supabase, userId } = context;
    const { data: saved, error } = await supabase
      .from("generated_content")
      .insert({
        user_id: userId,
        kind: "audio",
        title: data.title,
        prompt: data.text.slice(0, 400),
        payload: { voice: data.voice, audioBase64, text: data.text },
        subject_id: data.subjectId ?? null,
        thread_id: data.threadId ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: saved.id, audioBase64 };
  });
