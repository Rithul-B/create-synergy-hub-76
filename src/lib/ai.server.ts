// Server-only helpers for Lovable AI Gateway.
const BASE = "https://ai.gateway.lovable.dev/v1";

function key() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("LOVABLE_API_KEY missing");
  return k;
}

export async function chatCompletion(messages: Array<{ role: string; content: string }>, opts?: { model?: string; json?: boolean }) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key()}`,
    },
    body: JSON.stringify({
      model: opts?.model ?? "google/gemini-3.6-flash",
      messages,
      ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Rate limited. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
    throw new Error(`AI request failed [${res.status}]: ${body}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content as string;
}

export async function ttsBase64(text: string, voice = "alloy") {
  const res = await fetch(`${BASE}/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key()}`,
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
