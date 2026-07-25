import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parsePreferences, preferenceInstructions } from "@/lib/preferences";
import { z } from "zod";

const SendInput = z.object({
  threadId: z.string().uuid(),
  content: z.string().max(20000),
  images: z.array(z.string()).max(4).optional(), // data URLs
  mode: z.enum(["chat", "image"]).optional(),
});

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const images = data.images ?? [];
    const mode = data.mode ?? "chat";

    if (!data.content.trim() && images.length === 0) {
      throw new Error("Message is empty");
    }

    const { data: thread, error: threadErr } = await supabase
      .from("threads")
      .select("id, title, subject_id, subjects(name, description)")
      .eq("id", data.threadId)
      .single();
    if (threadErr || !thread) throw new Error("Thread not found");

    // Save user message. Encode attached images as markdown so the UI renders them.
    const userStored =
      images.map((u) => `![attached image](${u})`).join("\n\n") +
      (images.length && data.content ? "\n\n" : "") +
      data.content;

    const { error: userMsgErr } = await supabase.from("messages").insert({
      thread_id: data.threadId,
      user_id: userId,
      role: "user",
      content: userStored,
    });
    if (userMsgErr) throw new Error(userMsgErr.message);

    const { chatCompletion, generateImageDataUrl } = await import("./ai.server");
    const subjectName = (thread as { subjects?: { name?: string } }).subjects?.name;

    let assistantText: string;

    if (mode === "image") {
      // Generate an image from the prompt.
      const prompt = subjectName
        ? `Educational illustration for a ${subjectName} student: ${data.content}`
        : data.content;
      const dataUrl = await generateImageDataUrl(prompt);
      assistantText = `![generated image](${dataUrl})`;
    } else {
      // Text chat with optional image understanding. Load history (text-only for size).
      const { data: history } = await supabase
        .from("messages")
        .select("role, content")
        .eq("thread_id", data.threadId)
        .order("created_at", { ascending: true })
        .limit(40);

      const { data: profile } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", userId)
        .maybeSingle();
      const guidance = preferenceInstructions(parsePreferences(profile?.preferences));

      const base = subjectName
        ? `You are an expert AI tutor helping a student in the subject: ${subjectName}. Provide clear, accurate, well-structured explanations. Use markdown formatting.`
        : `You are a helpful AI assistant. Provide clear, well-structured answers using markdown.`;
      const system = guidance ? `${base} ${guidance}` : base;

      // Strip data URLs from historical messages to keep prompt small; keep placeholder.
      const cleaned = (history ?? []).slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content.replace(/!\[[^\]]*\]\(data:[^)]+\)/g, "[image]"),
      }));

      // Build final user message as multimodal if images attached.
      const finalUser =
        images.length > 0
          ? {
              role: "user",
              content: [
                ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
                { type: "text" as const, text: data.content || "Please analyze the attached image(s)." },
              ],
            }
          : { role: "user", content: data.content };

      const model = images.length > 0 ? "google/gemini-2.5-flash" : undefined;
      assistantText = await chatCompletion(
        [{ role: "system", content: system }, ...cleaned, finalUser],
        model ? { model } : undefined,
      );
    }

    await supabase.from("messages").insert({
      thread_id: data.threadId,
      user_id: userId,
      role: "assistant",
      content: assistantText,
    });

    const titleSource = data.content || (mode === "image" ? "Image generation" : "Image analysis");
    if (thread.title === "New chat" || !thread.title) {
      const title = titleSource.slice(0, 60).replace(/\s+/g, " ").trim();
      await supabase.from("threads").update({ title, updated_at: new Date().toISOString() }).eq("id", data.threadId);
    } else {
      await supabase.from("threads").update({ updated_at: new Date().toISOString() }).eq("id", data.threadId);
    }

    return { ok: true, assistant: assistantText };
  });
