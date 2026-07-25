import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ImageInput = z.object({
  imageDataUrl: z.string().max(8_000_000),
});

const PlanInput = z.object({
  examTitle: z.string().max(500),
  examDate: z.string(),
  topics: z.array(z.string().max(300)).max(100),
  syllabusText: z.string().max(20000).optional(),
});

export const scanSyllabusImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ImageInput.parse(d))
  .handler(async ({ data }) => {
    const { chatCompletion } = await import("./ai.server");
    const raw = await chatCompletion(
      [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are an exam syllabus analyzer. Extract ALL topics, chapters, units, and learning objectives from this syllabus image.
Return JSON only:
{
  "syllabus_summary": "brief overview",
  "topics": ["Topic 1", "Topic 2", ...]
}
Use clear, short topic names. Include every distinct topic you can find.`,
            },
            { type: "image_url", image_url: { url: data.imageDataUrl } },
          ],
        },
      ],
      { model: "google/gemini-2.5-flash", json: true },
    );

    const parsed = JSON.parse(raw) as { syllabus_summary?: string; topics?: string[] };
    return {
      syllabus_summary: parsed.syllabus_summary ?? "",
      topics: (parsed.topics ?? []).filter(Boolean).map(String),
    };
  });

export const generateStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PlanInput.parse(d))
  .handler(async ({ data }) => {
    const { chatCompletion } = await import("./ai.server");
    const examDate = new Date(data.examDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.max(1, Math.ceil((examDate.getTime() - today.getTime()) / 86_400_000));

    const raw = await chatCompletion(
      [
        {
          role: "system",
          content: "You are an expert exam coach. Create realistic daily study plans. Return JSON only.",
        },
        {
          role: "user",
          content: `Exam: ${data.examTitle}
Exam date: ${data.examDate}
Days until exam: ${daysLeft}
Topics to cover: ${data.topics.join(", ")}
${data.syllabusText ? `Syllabus notes: ${data.syllabusText}` : ""}

Create a day-by-day study plan from today until the exam. Prioritize weak/unstudied topics first, review closer to exam date.

Return JSON:
{
  "plan": [
    { "date": "YYYY-MM-DD", "label": "Day 1 — Foundations", "topics": ["topic a", "topic b"], "notes": "2 hours, focus on..." }
  ],
  "tips": ["tip 1", "tip 2"]
}`,
        },
      ],
      { json: true },
    );

    const parsed = JSON.parse(raw) as {
      plan?: Array<{ date: string; label: string; topics: string[]; notes?: string }>;
      tips?: string[];
    };

    return {
      plan: parsed.plan ?? [],
      tips: parsed.tips ?? [],
    };
  });

export const testAiConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { chatCompletion, getAiBackendName } = await import("./ai.server");
    const backend = getAiBackendName();
    const reply = await chatCompletion(
      [{ role: "user", content: "Reply with exactly: OK" }],
      { model: "google/gemini-3.6-flash" },
    );
    const ok = reply.trim().toUpperCase().includes("OK") || backend === "offline";
    const label =
      backend === "lovable" ? "Lovable AI" : backend === "gemini" ? "Google Gemini" : "Built-in study mode (no key)";
    return { ok, message: `${label} — ${reply.trim().slice(0, 80)}`, backend };
  });

export const searchSyllabusText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ query: z.string().max(500), syllabusText: z.string().max(50000) }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!data.syllabusText.trim()) {
      return { matches: [] as string[], answer: "No syllabus loaded yet. Scan or paste a syllabus first." };
    }
    const { chatCompletion } = await import("./ai.server");
    const raw = await chatCompletion(
      [
        {
          role: "user",
          content: `Syllabus text:
"""
${data.syllabusText.slice(0, 15000)}
"""

User question: ${data.query}

Find relevant topics from the syllabus. Return JSON:
{ "matches": ["topic1", "topic2"], "answer": "brief helpful answer" }`,
        },
      ],
      { json: true },
    );
    const parsed = JSON.parse(raw) as { matches?: string[]; answer?: string };
    return { matches: parsed.matches ?? [], answer: parsed.answer ?? "" };
  });
