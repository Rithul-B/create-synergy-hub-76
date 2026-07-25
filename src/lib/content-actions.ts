import { supabase } from "@/integrations/supabase/client";
import { downloadDeck } from "./pptx-download";
import type { Deck } from "./pptx.functions";
import type { VideoPlan } from "./video.functions";

export type ContentRef = { id: string; kind: string; title: string };

/** Payloads hold base64 audio and full decks, so they're fetched only on demand. */
export async function fetchPayload(id: string) {
  const { data, error } = await supabase.from("generated_content").select("payload").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data.payload as unknown;
}

function saveBlob(href: string, filename: string, revoke = false) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  if (revoke) URL.revokeObjectURL(href);
}

function safeName(title: string) {
  return title.replace(/[^\w]+/g, "_");
}

export async function audioSrcFor(id: string) {
  const payload = await fetchPayload(id);
  const base64 = (payload as { audioBase64?: string }).audioBase64;
  if (!base64) throw new Error("This recording is no longer available");
  return `data:audio/mp3;base64,${base64}`;
}

function videoPlanToText(plan: VideoPlan) {
  return [
    plan.title,
    "",
    plan.script,
    "",
    ...(plan.scenes ?? []).map(
      (s) => `Scene ${s.index} (${s.duration}s)\nVisual: ${s.visual}\nNarration: ${s.narration}\nCaption: ${s.caption}\n`,
    ),
  ].join("\n");
}

/** Downloads a saved item in its natural format: .pptx, .mp3, or a script .txt. */
export async function downloadContent(item: ContentRef) {
  const payload = await fetchPayload(item.id);
  if (item.kind === "audio") {
    const base64 = (payload as { audioBase64?: string }).audioBase64;
    if (!base64) throw new Error("This recording is no longer available");
    saveBlob(`data:audio/mp3;base64,${base64}`, `${safeName(item.title)}.mp3`);
    return;
  }
  if (item.kind === "powerpoint") {
    await downloadDeck(payload as Deck);
    return;
  }
  const text = videoPlanToText(payload as VideoPlan);
  saveBlob(URL.createObjectURL(new Blob([text], { type: "text/plain" })), `${safeName(item.title)}_script.txt`, true);
}
