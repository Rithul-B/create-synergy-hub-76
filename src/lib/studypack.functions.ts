import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parsePreferences, preferenceInstructions } from "@/lib/preferences";
import { z } from "zod";
import type { Deck } from "./pptx.functions";
import type { VideoPlan } from "./video.functions";

const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;

const Input = z.object({
  threadId: z.string().uuid(),
  slideCount: z.number().int().min(3).max(20).default(8),
  voice: z.enum(VOICES).default("alloy"),
  videoDuration: z.number().int().min(10).max(120).default(45),
});

export type StudyPack = {
  topic: string;
  deck: { id: string; title: string; value: Deck } | null;
  audio: { id: string; title: string; base64: string; script: string } | null;
  video: { id: string; title: string; value: VideoPlan } | null;
  failures: string[];
};

function parseJsonObject<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI returned invalid JSON");
    return JSON.parse(match[0]) as T;
  }
}

/**
 * Turns one conversation into a complete lesson bundle: slide deck, narrated
 * summary, and video plan. Each piece is independent, so a single failure
 * degrades the pack rather than losing everything.
 */
export const createStudyPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<StudyPack> => {
    const { supabase, userId } = context;
    const { chatCompletion, ttsBase64 } = await import("./ai.server");

    const { data: thread, error: threadErr } = await supabase
      .from("threads")
      .select("id, title, subject_id, subjects(name)")
      .eq("id", data.threadId)
      .single();
    if (threadErr || !thread) throw new Error("Chat not found");

    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("thread_id", data.threadId)
      .order("created_at");

    const transcript = (history ?? [])
      .map((m) => `${m.role.toUpperCase()}: ${m.content.replace(/!\[[^\]]*\]\([^)]*\)/g, "[image]")}`)
      .join("\n\n")
      .slice(-12000);
    if (!transcript.trim()) throw new Error("This chat has no messages yet");

    const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", userId).maybeSingle();
    const guidance = preferenceInstructions(parsePreferences(profile?.preferences));
    const subjectName = (thread as { subjects?: { name?: string } }).subjects?.name;
    const topic = thread.title && thread.title !== "New chat" ? thread.title : "Study session";
    const audience = [subjectName ? `Subject: ${subjectName}.` : "", guidance].filter(Boolean).join(" ");

    const failures: string[] = [];

    const deckPromise = (async () => {
      const sys = `You generate structured slide decks as JSON. Output ONLY valid JSON matching:
{ "title": string, "slides": Array<{ "title": string, "bullets": string[], "notes": string, "imageSuggestion"?: string }>, "references"?: string[] }
Rules: Include a title slide and a conclusion slide. 3-6 concise bullets per slide (max ~12 words). Speaker notes 1-3 sentences. Total slides: ${data.slideCount}. ${audience}`;
      const raw = await chatCompletion(
        [
          { role: "system", content: sys },
          { role: "user", content: `Build a revision deck from this tutoring conversation about "${topic}":\n\n${transcript}` },
        ],
        { json: true },
      );
      const deck = parseJsonObject<Deck>(raw);
      if (!deck.slides?.length) throw new Error("No slides produced");
      return deck;
    })();

    const scriptPromise = (async () => {
      const raw = await chatCompletion([
        {
          role: "system",
          content: `You write spoken revision summaries to be read aloud. Plain sentences only — no markdown, headings, bullets, or symbols. 180-260 words. ${audience}`,
        },
        { role: "user", content: `Summarise the key learning from this conversation about "${topic}":\n\n${transcript}` },
      ]);
      const clean = raw.replace(/[#*_`>]/g, "").trim();
      if (!clean) throw new Error("No narration script produced");
      return clean;
    })();

    const planPromise = (async () => {
      const sys = `You are a video producer. Output ONLY valid JSON matching:
{ "title": string, "script": string, "scenes": Array<{ "index": number, "duration": number, "visual": string, "narration": string, "caption": string }>, "musicMood": string }
Design a ${data.videoDuration}-second educational recap video, aspect ratio 16:9. Scenes of ~5-8s each summing to ${data.videoDuration}s. Narration must be natural spoken text. ${audience}`;
      const raw = await chatCompletion(
        [
          { role: "system", content: sys },
          { role: "user", content: `Create a recap video plan for this conversation about "${topic}":\n\n${transcript}` },
        ],
        { json: true },
      );
      const plan = parseJsonObject<VideoPlan>(raw);
      if (!plan.scenes?.length) throw new Error("No scenes produced");
      return plan;
    })();

    const [deckResult, scriptResult, planResult] = await Promise.allSettled([deckPromise, scriptPromise, planPromise]);

    const shared = {
      user_id: userId,
      subject_id: thread.subject_id ?? null,
      thread_id: data.threadId,
      prompt: `Study pack from “${topic}”`,
    };

    let deck: StudyPack["deck"] = null;
    if (deckResult.status === "fulfilled") {
      const value = deckResult.value;
      const { data: saved, error } = await supabase
        .from("generated_content")
        .insert({ ...shared, kind: "powerpoint", title: value.title || `${topic} — slides`, payload: JSON.parse(JSON.stringify(value)) })
        .select("id")
        .single();
      if (error) failures.push("Slides could not be saved");
      else deck = { id: saved.id, title: value.title || `${topic} — slides`, value };
    } else {
      failures.push("Slides could not be generated");
    }

    let audio: StudyPack["audio"] = null;
    if (scriptResult.status === "fulfilled") {
      const script = scriptResult.value;
      try {
        const base64 = await ttsBase64(script, data.voice);
        const title = `${topic} — narrated summary`;
        const { data: saved, error } = await supabase
          .from("generated_content")
          .insert({ ...shared, kind: "audio", title, payload: { voice: data.voice, audioBase64: base64, text: script } })
          .select("id")
          .single();
        if (error) failures.push("Narration could not be saved");
        else audio = { id: saved.id, title, base64, script };
      } catch {
        failures.push("Narration could not be generated");
      }
    } else {
      failures.push("Narration script could not be written");
    }

    let video: StudyPack["video"] = null;
    if (planResult.status === "fulfilled") {
      const value = planResult.value;
      const title = value.title || `${topic} — video plan`;
      const { data: saved, error } = await supabase
        .from("generated_content")
        .insert({
          ...shared,
          kind: "video",
          title,
          status: "plan_ready",
          payload: JSON.parse(JSON.stringify({ ...value, duration: data.videoDuration, aspectRatio: "16:9" })),
        })
        .select("id")
        .single();
      if (error) failures.push("Video plan could not be saved");
      else video = { id: saved.id, title, value };
    } else {
      failures.push("Video plan could not be generated");
    }

    if (!deck && !audio && !video) {
      throw new Error(failures[0] ?? "Study pack could not be created");
    }
    return { topic, deck, audio, video, failures };
  });
