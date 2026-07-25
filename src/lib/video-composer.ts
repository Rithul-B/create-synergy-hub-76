/**
 * Browser-side video renderer: paints scenes onto a canvas, plays the narration
 * through a Web Audio graph, and records both into a single WebM file.
 *
 * Recording happens in real time, so a 30-second video takes ~30 seconds to
 * produce and the tab must stay visible (browsers throttle animation frames in
 * background tabs, which would stretch the timeline).
 */

export type SceneAsset = {
  index: number;
  caption: string;
  narration: string;
  /** Fallback length when a scene has no narration audio. */
  duration: number;
  imageDataUrl?: string;
  audioBase64?: string;
};

export type RenderProgress = {
  stage: "preparing" | "recording" | "finishing";
  sceneNumber: number;
  sceneTotal: number;
  secondsDone: number;
  secondsTotal: number;
};

export type RenderResult = { blob: Blob; extension: string; durationSeconds: number };

const DIMENSIONS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "1:1": { width: 1080, height: 1080 },
};

export function isVideoRenderingSupported() {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

function pickMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

function base64ToArrayBuffer(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function animate(durationMs: number, draw: (progress: number) => void) {
  return new Promise<void>((resolve) => {
    const start = performance.now();
    function frame(now: number) {
      const elapsed = now - start;
      draw(Math.min(elapsed / durationMs, 1));
      if (elapsed >= durationMs) resolve();
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

/** Draws the image to fill the canvas, cropping overflow, with a slow zoom. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
  zoom: number,
) {
  const scale = Math.max(width / img.width, height / img.height) * zoom;
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
}

function drawGradientBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#1e1b4b");
  gradient.addColorStop(1, "#4338ca");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawCaption(ctx: CanvasRenderingContext2D, text: string, width: number, height: number) {
  if (!text.trim()) return;
  const fontSize = Math.round(width / 26);
  ctx.font = `600 ${fontSize}px Inter, Segoe UI, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrapText(ctx, text, width * 0.84).slice(0, 3);
  const lineHeight = fontSize * 1.32;
  const blockHeight = lines.length * lineHeight;
  const boxTop = height - blockHeight - fontSize * 1.9;

  ctx.fillStyle = "rgba(10, 8, 30, 0.66)";
  ctx.fillRect(0, boxTop - fontSize * 0.5, width, blockHeight + fontSize * 1.2);

  ctx.fillStyle = "#ffffff";
  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, boxTop + lineHeight * i + lineHeight / 2);
  });
}

function drawTitleCard(
  ctx: CanvasRenderingContext2D,
  title: string,
  width: number,
  height: number,
  progress: number,
) {
  drawGradientBackdrop(ctx, width, height);
  const fontSize = Math.round(width / 16);
  ctx.font = `700 ${fontSize}px Inter, Segoe UI, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrapText(ctx, title, width * 0.8).slice(0, 3);
  const lineHeight = fontSize * 1.25;
  const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;

  ctx.globalAlpha = Math.min(1, progress * 3);
  ctx.fillStyle = "#ffffff";
  lines.forEach((line, i) => ctx.fillText(line, width / 2, startY + lineHeight * i));
  ctx.globalAlpha = 1;
}

export async function composeVideo(opts: {
  title: string;
  scenes: SceneAsset[];
  aspectRatio: string;
  onProgress?: (p: RenderProgress) => void;
}): Promise<RenderResult> {
  if (!isVideoRenderingSupported()) {
    throw new Error("This browser cannot record video. Try Chrome or Edge.");
  }
  const mimeType = pickMimeType();
  if (!mimeType) throw new Error("This browser has no supported video encoder.");

  const { width, height } = DIMENSIONS[opts.aspectRatio] ?? DIMENSIONS["16:9"];
  const TITLE_CARD_MS = 2400;

  opts.onProgress?.({
    stage: "preparing",
    sceneNumber: 0,
    sceneTotal: opts.scenes.length,
    secondsDone: 0,
    secondsTotal: 0,
  });

  const audioCtx = new AudioContext();
  await audioCtx.resume();

  const prepared = await Promise.all(
    opts.scenes.map(async (scene) => {
      const [image, audio] = await Promise.all([
        scene.imageDataUrl ? loadImage(scene.imageDataUrl) : Promise.resolve(null),
        scene.audioBase64
          ? audioCtx.decodeAudioData(base64ToArrayBuffer(scene.audioBase64)).catch(() => null)
          : Promise.resolve(null),
      ]);
      const seconds = audio ? audio.duration + 0.45 : Math.max(scene.duration, 3);
      return { scene, image, audio, seconds };
    }),
  );

  const secondsTotal = prepared.reduce((sum, p) => sum + p.seconds, 0) + TITLE_CARD_MS / 1000;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a drawing surface.");

  const videoStream = canvas.captureStream(30);
  const audioDestination = audioCtx.createMediaStreamDestination();

  // Narration only plays during scenes, and MediaRecorder discards the whole
  // recording if its audio track ever goes idle. A silent constant source keeps
  // the track producing samples from the first frame to the last.
  const silence = audioCtx.createConstantSource();
  silence.offset.value = 0;
  silence.connect(audioDestination);
  silence.start();

  const stream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioDestination.stream.getAudioTracks(),
  ]);

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const finished = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start(250);

  try {
    await animate(TITLE_CARD_MS, (p) => drawTitleCard(ctx, opts.title, width, height, p));

    let secondsDone = TITLE_CARD_MS / 1000;
    for (let i = 0; i < prepared.length; i++) {
      const { scene, image, audio, seconds } = prepared[i];
      opts.onProgress?.({
        stage: "recording",
        sceneNumber: i + 1,
        sceneTotal: prepared.length,
        secondsDone,
        secondsTotal,
      });

      if (audio) {
        const source = audioCtx.createBufferSource();
        source.buffer = audio;
        source.connect(audioDestination);
        source.start(audioCtx.currentTime + 0.2);
      }

      await animate(seconds * 1000, (progress) => {
        if (image) {
          drawCover(ctx, image, width, height, 1 + progress * 0.07);
        } else {
          drawGradientBackdrop(ctx, width, height);
        }
        drawCaption(ctx, scene.caption || scene.narration, width, height);
      });
      secondsDone += seconds;
    }

    opts.onProgress?.({
      stage: "finishing",
      sceneNumber: prepared.length,
      sceneTotal: prepared.length,
      secondsDone: secondsTotal,
      secondsTotal,
    });
  } finally {
    // Tracks must stay live until the recorder has flushed its final chunk,
    // otherwise the recording comes back empty.
    if (recorder.state !== "inactive") recorder.stop();
  }

  await finished;
  silence.stop();
  stream.getTracks().forEach((t) => t.stop());
  videoStream.getTracks().forEach((t) => t.stop());
  await audioCtx.close();

  const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
  if (blob.size === 0) throw new Error("Recording came back empty — please try again with this tab in the foreground.");
  return {
    blob,
    extension: mimeType.startsWith("video/mp4") ? "mp4" : "webm",
    durationSeconds: Math.round(secondsTotal),
  };
}
