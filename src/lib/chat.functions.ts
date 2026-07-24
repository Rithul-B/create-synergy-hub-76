import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SendInput = z.object({
  threadId: z.string().uuid(),
  content: z.string().min(1).max(20000),
});

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load thread + subject for context
    const { data: thread, error: threadErr } = await supabase
      .from("threads")
      .select("id, title, subject_id, subjects(name, description)")
      .eq("id", data.threadId)
      .single();
    if (threadErr || !thread) throw new Error("Thread not found");

    // Insert user message
    const { error: userMsgErr } = await supabase.from("messages").insert({
      thread_id: data.threadId,
      user_id: userId,
      role: "user",
      content: data.content,
    });
    if (userMsgErr) throw new Error(userMsgErr.message);

    // Load full history
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });

    const subjectName = (thread as { subjects?: { name?: string } }).subjects?.name;
    const system = subjectName
      ? `You are an expert AI tutor helping a student in the subject: ${subjectName}. Provide clear, accurate, well-structured explanations. Use markdown formatting.`
      : `You are a helpful AI assistant. Provide clear, well-structured answers using markdown.`;

    const { chatCompletion } = await import("./ai.server");
    const messages = [
      { role: "system", content: system },
      ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
    ];
    const assistantText = await chatCompletion(messages);

    // Save assistant message
    await supabase.from("messages").insert({
      thread_id: data.threadId,
      user_id: userId,
      role: "assistant",
      content: assistantText,
    });

    // Auto-title if still default
    if (thread.title === "New chat" || !thread.title) {
      const title = data.content.slice(0, 60).replace(/\s+/g, " ").trim();
      await supabase.from("threads").update({ title, updated_at: new Date().toISOString() }).eq("id", data.threadId);
    } else {
      await supabase.from("threads").update({ updated_at: new Date().toISOString() }).eq("id", data.threadId);
    }

    return { ok: true, assistant: assistantText };
  });
