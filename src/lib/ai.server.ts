// Server-only AI helpers — Lovable Gateway (deployed) or Google Gemini (local dev).
const LOVABLE_BASE = "https://ai.gateway.lovable.dev/v1";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function lovableKey() {
  const k =
    process.env.LOVABLE_API_KEY ??
    process.env.VITE_LOVABLE_API_KEY ??
    process.env.LOVABLE_AI_KEY;
  return k?.trim() || null;
}

function geminiKey() {
  const k = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  return k?.trim() || null;
}

function aiBackend(): "lovable" | "gemini" | "offline" {
  if (lovableKey()) return "lovable";
  if (geminiKey()) return "gemini";
  return "offline";
}

export function getAiBackendName(): "lovable" | "gemini" | "offline" {
  return aiBackend();
}

export type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export type ChatMessage = { role: string; content: ChatContent };

function geminiModel(fallback = "gemini-2.0-flash") {
  const m = process.env.GEMINI_MODEL?.trim();
  return m || fallback;
}

class RateLimitError extends Error {
  constructor() {
    super("Rate limited. Please try again in a moment.");
    this.name = "RateLimitError";
  }
}

const RATE_LIMIT_NOTE =
  "\n\n---\n*Full AI is temporarily rate-limited. This response uses the built-in study assistant — try again in a moment for full AI answers.*";

async function offlineChatFallback(
  messages: ChatMessage[],
  opts?: { model?: string; json?: boolean },
  rateLimited = false,
): Promise<string> {
  const { offlineChatJson, offlineChatReply } = await import("./offline-ai");
  const last = messages.filter((m) => m.role === "user").pop();
  const text =
    typeof last?.content === "string"
      ? last.content
      : Array.isArray(last?.content)
        ? last.content.find((p) => p.type === "text")?.text ?? ""
        : "";
  const hasImage = messages.some(
    (m) => Array.isArray(m.content) && m.content.some((p) => p.type === "image_url"),
  );

  let result: string;
  if (hasImage) {
    result = opts?.json
      ? JSON.stringify({
          syllabus_summary: "Image received — paste syllabus text below for topic extraction (built-in mode).",
          topics: [],
        })
      : "I can see you uploaded an image. **Built-in mode** can't read images yet — paste the syllabus text in the box below, and topics will be extracted automatically.\n\nFor image scanning, add a free `GEMINI_API_KEY` from aistudio.google.com/apikey.";
  } else if (opts?.json) {
    const full = messages
      .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
      .join("\n");
    result = offlineChatJson(full + "\n" + text);
  } else {
    result = offlineChatReply(text);
  }

  if (rateLimited) {
    if (opts?.json) {
      try {
        const parsed = JSON.parse(result) as Record<string, unknown>;
        parsed.rate_limited_note =
          "Full AI is temporarily rate-limited. This response uses the built-in study assistant.";
        if (Array.isArray(parsed.tips)) {
          parsed.tips = [
            "Full AI is temporarily rate-limited — try again shortly for personalized plans.",
            ...parsed.tips,
          ];
        }
        result = JSON.stringify(parsed);
      } catch {
        // keep raw result if JSON parse fails
      }
    } else {
      result += RATE_LIMIT_NOTE;
    }
  }

  return result;
}

async function geminiChatCompletion(
  messages: ChatMessage[],
  opts?: { model?: string; json?: boolean },
): Promise<string> {
  const key = geminiKey()!;
  const model = geminiModel(opts?.model?.includes("gemini") ? opts.model.split("/").pop()! : undefined);

  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];
      if (typeof m.content === "string") {
        parts.push({ text: m.content });
      } else {
        for (const part of m.content) {
          if (part.type === "text") parts.push({ text: part.text });
          else if (part.type === "image_url") {
            const url = part.image_url.url;
            const match = url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
            }
          }
        }
      }
      return {
        role: m.role === "assistant" ? "model" : "user",
        parts,
      };
    });

  const system = messages.find((m) => m.role === "system");
  const body: Record<string, unknown> = {
    contents,
    ...(system
      ? { systemInstruction: { parts: [{ text: typeof system.content === "string" ? system.content : "" }] } }
      : {}),
    ...(opts?.json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
  };

  const res = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 429) throw new RateLimitError();
    throw new Error(`Gemini API failed [${res.status}]: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
  if (!text) throw new Error("No response from Gemini");
  return text;
}

async function lovableChatCompletion(
  messages: ChatMessage[],
  opts?: { model?: string; json?: boolean },
): Promise<string> {
  const res = await fetch(`${LOVABLE_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey()}`,
    },
    body: JSON.stringify({
      model: opts?.model ?? "google/gemini-3.6-flash",
      messages,
      ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new RateLimitError();
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
    throw new Error(`AI request failed [${res.status}]: ${body}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content as string;
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts?: { model?: string; json?: boolean },
) {
  const backend = aiBackend();
  if (backend === "offline") {
    return offlineChatFallback(messages, opts);
  }
  try {
    return backend === "gemini"
      ? await geminiChatCompletion(messages, opts)
      : await lovableChatCompletion(messages, opts);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return offlineChatFallback(messages, opts, true);
    }
    throw err;
  }
}

export async function generateImageDataUrl(prompt: string): Promise<string> {
  if (aiBackend() !== "lovable") {
    throw new Error("Image generation needs Lovable preview or LOVABLE_API_KEY. Chat & exam planning work in built-in mode.");
  }
  const res = await fetch(`${LOVABLE_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey()}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Rate limited. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
    throw new Error(`Image generation failed [${res.status}]: ${body}`);
  }
  const data = await res.json();
  const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;
  if (!url) throw new Error("No image returned");
  return url;
}

export async function ttsBase64(text: string, voice = "alloy") {
  if (aiBackend() !== "lovable") {
    throw new Error("Audio generation needs Lovable preview. Chat & exam planning work in built-in mode.");
  }
  const res = await fetch(`${LOVABLE_BASE}/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey()}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini-tts",
      voice,
      input: text,
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Rate limited. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
    throw new Error(`TTS failed [${res.status}]: ${body}`);
  }
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}
