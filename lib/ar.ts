"use client";
/**
 * jepret AR: face, hand and body tracking with MediaPipe Tasks (Apache-2.0),
 * plus original accessories drawn on a canvas. The runtime and models are
 * served from /mediapipe on our own domain and only load when a guest turns
 * an effect on.
 */
import type { FaceLandmarker, HandLandmarker, NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";

export type ArKind = "face" | "hand" | "pose";
export type ArEffect = { id: string; kind: ArKind; name: { id: string; en: string } };

export const AR_EFFECTS: ArEffect[] = [
  { id: "shades", kind: "face", name: { id: "Kacamata", en: "Shades" } },
  { id: "partyhat", kind: "face", name: { id: "Topi pesta", en: "Party hat" } },
  { id: "crown", kind: "face", name: { id: "Mahkota", en: "Crown" } },
  { id: "mustache", kind: "face", name: { id: "Kumis", en: "Mustache" } },
  { id: "bunny", kind: "face", name: { id: "Kelinci", en: "Bunny" } },
  { id: "flowers", kind: "face", name: { id: "Bunga", en: "Flowers" } },
  { id: "sparkle", kind: "hand", name: { id: "Kilau jari", en: "Sparkles" } },
  { id: "hearts", kind: "hand", name: { id: "Hati", en: "Hearts" } },
  { id: "bowtie", kind: "pose", name: { id: "Dasi kupu", en: "Bow tie" } },
  { id: "wings", kind: "pose", name: { id: "Sayap", en: "Wings" } },
];

export const getEffect = (id: string | null) => AR_EFFECTS.find((e) => e.id === id) ?? null;

/* ---------------------------------------------------------------- trackers */

type Tracker = FaceLandmarker | HandLandmarker | PoseLandmarker;
const MODELS: Record<ArKind, string> = {
  face: "/mediapipe/models/face_landmarker.task",
  hand: "/mediapipe/models/hand_landmarker.task",
  pose: "/mediapipe/models/pose_landmarker_lite.task",
};
const trackers: Partial<Record<ArKind, Promise<Tracker>>> = {};

async function create(kind: ArKind, delegate: "GPU" | "CPU"): Promise<Tracker> {
  const vision = await import("@mediapipe/tasks-vision");
  const files = await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");
  const baseOptions = { modelAssetPath: MODELS[kind], delegate };
  if (kind === "face") return vision.FaceLandmarker.createFromOptions(files, { baseOptions, runningMode: "VIDEO", numFaces: 4 });
  if (kind === "hand") return vision.HandLandmarker.createFromOptions(files, { baseOptions, runningMode: "VIDEO", numHands: 2 });
  return vision.PoseLandmarker.createFromOptions(files, { baseOptions, runningMode: "VIDEO", numPoses: 2 });
}

export function loadTracker(kind: ArKind): Promise<Tracker> {
  if (!trackers[kind]) {
    trackers[kind] = create(kind, "GPU")
      .catch(() => create(kind, "CPU"))
      .catch((e) => {
        delete trackers[kind];
        throw e;
      });
  }
  return trackers[kind]!;
}

let lastTs = 0;
/** Runs the tracker on the current video frame; returns landmark sets in normalised coords. */
export function detect(kind: ArKind, tracker: Tracker, video: HTMLVideoElement): NormalizedLandmark[][] {
  const ts = Math.max(performance.now(), lastTs + 1);
  lastTs = ts;
  if (kind === "face") return (tracker as FaceLandmarker).detectForVideo(video, ts).faceLandmarks ?? [];
  if (kind === "hand") return (tracker as HandLandmarker).detectForVideo(video, ts).landmarks ?? [];
  return (tracker as PoseLandmarker).detectForVideo(video, ts).landmarks ?? [];
}

/* ---------------------------------------------------------------- drawing */

type P = { x: number; y: number };
const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const lerp = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

/** Draws `effect` for every detected person/hand. Coordinates are in canvas pixels of a w×h frame. */
export function drawEffect(ctx: CanvasRenderingContext2D, effect: ArEffect, sets: NormalizedLandmark[][], w: number, h: number, t: number) {
  for (const lm of sets) {
    const p = (i: number): P => ({ x: lm[i].x * w, y: lm[i].y * h });
    ctx.save();
    try {
      if (effect.kind === "face") drawFace(ctx, effect.id, p);
      else if (effect.kind === "hand") drawHand(ctx, effect.id, p, t);
      else if ((lm[11].visibility ?? 1) > 0.4 && (lm[12].visibility ?? 1) > 0.4) drawPose(ctx, effect.id, p, t);
    } finally {
      ctx.restore();
    }
  }
}

/* ---- face ---------------------------------------------------------------- */

function drawFace(ctx: CanvasRenderingContext2D, id: string, p: (i: number) => P) {
  const eyeA = mid(p(33), p(133)); // eye on the image's left
  const eyeB = mid(p(362), p(263));
  const ang = Math.atan2(eyeB.y - eyeA.y, eyeB.x - eyeA.x);
  const ipd = dist(eyeA, eyeB);
  const faceW = dist(p(234), p(454));
  const faceH = dist(p(10), p(152));
  const up: P = { x: Math.sin(ang), y: -Math.cos(ang) };
  const at = (o: P, k: number): P => ({ x: o.x + up.x * k, y: o.y + up.y * k });
  const local = (o: P) => {
    ctx.translate(o.x, o.y);
    ctx.rotate(ang);
  };

  if (id === "shades") {
    local(mid(eyeA, eyeB));
    const lw = ipd * 0.8;
    const lh = lw * 0.68;
    const s = ipd * 0.055;
    ctx.lineJoin = "round";
    // arms toward the temples
    ctx.strokeStyle = "#0b0b0d";
    ctx.lineWidth = s;
    for (const sg of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sg * (ipd / 2 + lw / 2), -lh * 0.28);
      ctx.lineTo(sg * faceW * 0.5, -lh * 0.12);
      ctx.stroke();
    }
    for (const sg of [-1, 1]) {
      const cx = sg * ipd * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - lw / 2, -lh / 2);
      ctx.lineTo(cx + lw / 2, -lh / 2);
      ctx.quadraticCurveTo(cx + lw / 2 + s, lh * 0.15, cx + lw * 0.3, lh / 2);
      ctx.quadraticCurveTo(cx, lh * 0.62, cx - lw * 0.3, lh / 2);
      ctx.quadraticCurveTo(cx - lw / 2 - s, lh * 0.15, cx - lw / 2, -lh / 2);
      ctx.closePath();
      const g = ctx.createLinearGradient(cx, -lh / 2, cx, lh / 2);
      g.addColorStop(0, "rgba(40,40,48,.96)");
      g.addColorStop(1, "rgba(8,8,10,.96)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "#050506";
      ctx.lineWidth = s;
      ctx.stroke();
      // glare
      ctx.save();
      ctx.clip();
      ctx.fillStyle = "rgba(255,255,255,.22)";
      ctx.beginPath();
      ctx.moveTo(cx - lw * 0.1, -lh / 2);
      ctx.lineTo(cx + lw * 0.12, -lh / 2);
      ctx.lineTo(cx - lw * 0.3, lh / 2);
      ctx.lineTo(cx - lw * 0.52, lh / 2);
      ctx.fill();
      ctx.restore();
    }
    // bridge
    ctx.beginPath();
    ctx.moveTo(-ipd * 0.5 + lw / 2, -lh * 0.3);
    ctx.quadraticCurveTo(0, -lh * 0.55, ipd * 0.5 - lw / 2, -lh * 0.3);
    ctx.strokeStyle = "#0b0b0d";
    ctx.lineWidth = s * 1.2;
    ctx.stroke();
    return;
  }

  if (id === "mustache") {
    const mouthW = dist(p(61), p(291));
    local(lerp(p(2), p(13), 0.5));
    const W = mouthW * 0.55;
    const H = mouthW * 0.24;
    ctx.fillStyle = "#2a1c15";
    for (const sg of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -H * 0.35);
      ctx.bezierCurveTo(sg * W * 0.35, -H * 0.75, sg * W * 0.75, -H * 0.15, sg * W * 1.05, -H * 0.55);
      ctx.bezierCurveTo(sg * W * 1.22, -H * 0.75, sg * W * 1.2, -H * 1.15, sg * W * 1.02, -H * 1.12);
      ctx.bezierCurveTo(sg * W * 1.28, -H * 0.9, sg * W * 1.15, H * 0.2, sg * W * 0.7, H * 0.32);
      ctx.bezierCurveTo(sg * W * 0.35, H * 0.42, sg * W * 0.12, H * 0.1, 0, H * 0.02);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.beginPath();
    ctx.ellipse(-W * 0.45, -H * 0.2, W * 0.22, H * 0.08, -0.2, 0, Math.PI * 2);
    ctx.ellipse(W * 0.45, -H * 0.2, W * 0.22, H * 0.08, 0.2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const crownBase = at(p(10), faceH * 0.02);

  if (id === "partyhat") {
    local(at(p(10), faceH * 0.04));
    ctx.rotate(-0.12);
    const bw = faceW * 0.6;
    const hh = faceW * 0.95;
    ctx.beginPath();
    ctx.moveTo(-bw / 2, 0);
    ctx.lineTo(0, -hh);
    ctx.lineTo(bw / 2, 0);
    ctx.quadraticCurveTo(0, bw * 0.12, -bw / 2, 0);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "#ff5c8a";
    ctx.fillRect(-bw, -hh, bw * 2, hh * 1.2);
    ctx.fillStyle = "#ffd447";
    const sw = bw * 0.16;
    for (let i = -8; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * sw * 2, 0);
      ctx.lineTo(i * sw * 2 + sw, 0);
      ctx.lineTo(i * sw * 2 + sw + hh * 0.7, -hh);
      ctx.lineTo(i * sw * 2 + hh * 0.7, -hh);
      ctx.fill();
    }
    const shade = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
    shade.addColorStop(0, "rgba(0,0,0,.18)");
    shade.addColorStop(0.45, "rgba(255,255,255,.12)");
    shade.addColorStop(1, "rgba(0,0,0,.22)");
    ctx.fillStyle = shade;
    ctx.fillRect(-bw, -hh, bw * 2, hh * 1.2);
    ctx.restore();
    // trim + pompom
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath();
      ctx.arc(-bw / 2 + (bw / 8) * i, bw * 0.02, bw * 0.075, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, -hh, bw * 0.14, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (id === "crown") {
    local(at(p(10), faceH * 0.07));
    const cw = faceW * 0.82;
    const ch = faceW * 0.44;
    const g = ctx.createLinearGradient(0, -ch, 0, 0);
    g.addColorStop(0, "#fff1a8");
    g.addColorStop(0.5, "#f2c94c");
    g.addColorStop(1, "#b8860b");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#8a6508";
    ctx.lineWidth = faceW * 0.012;
    ctx.beginPath();
    ctx.moveTo(-cw / 2, 0);
    const peaks = 5;
    for (let i = 0; i <= peaks * 2; i++) {
      const x = -cw / 2 + (cw / (peaks * 2)) * i;
      const y = i % 2 === 0 ? (i === 0 || i === peaks * 2 ? -ch * 0.55 : -ch * 0.42) : -ch;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(cw / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#c99a1c";
    ctx.fillRect(-cw / 2, -ch * 0.22, cw, ch * 0.22);
    const jewels = ["#e63946", "#3a86ff", "#e63946", "#3a86ff", "#e63946"];
    jewels.forEach((c, i) => {
      const x = -cw / 2 + (cw / (peaks * 2)) * (i * 2 + 1);
      ctx.fillStyle = "#fff6cf";
      ctx.beginPath();
      ctx.arc(x, -ch, faceW * 0.03, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, -ch * 0.11, faceW * 0.035, 0, Math.PI * 2);
      ctx.fill();
    });
    return;
  }

  if (id === "bunny") {
    local(crownBase);
    const ew = faceW * 0.22;
    const eh = faceW * 0.85;
    for (const sg of [-1, 1]) {
      ctx.save();
      ctx.translate(sg * faceW * 0.2, 0);
      ctx.rotate(sg * 0.2);
      ctx.fillStyle = "#fbfbfb";
      ctx.strokeStyle = "rgba(0,0,0,.12)";
      ctx.lineWidth = faceW * 0.01;
      ctx.beginPath();
      ctx.ellipse(0, -eh / 2, ew / 2, eh / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffb4c8";
      ctx.beginPath();
      ctx.ellipse(0, -eh / 2 + eh * 0.04, ew * 0.27, eh * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // headband
    ctx.strokeStyle = "#fbfbfb";
    ctx.lineWidth = faceW * 0.05;
    ctx.beginPath();
    ctx.ellipse(0, faceH * 0.12, faceW * 0.5, faceH * 0.16, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    return;
  }

  if (id === "flowers") {
    local(at(p(10), -faceH * 0.02));
    const colors = ["#ff8fab", "#ffd166", "#ffffff", "#c8a2ff", "#ff8fab", "#ffd166", "#ffffff"];
    const n = colors.length;
    // leaves first
    ctx.fillStyle = "#5f9b62";
    for (let k = 0; k < n + 1; k++) {
      const a = Math.PI * (1.12 + (0.76 * (k - 0.5)) / (n - 1));
      const x = Math.cos(a) * faceW * 0.52;
      const y = Math.sin(a) * faceH * 0.2 + faceH * 0.08;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, faceW * 0.035, faceW * 0.075, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    colors.forEach((c, k) => {
      const a = Math.PI * (1.12 + (0.76 * k) / (n - 1));
      const x = Math.cos(a) * faceW * 0.52;
      const y = Math.sin(a) * faceH * 0.2 + faceH * 0.08;
      const r = faceW * (k % 2 ? 0.055 : 0.07);
      ctx.fillStyle = c;
      for (let i = 0; i < 5; i++) {
        const pa = (i / 5) * Math.PI * 2 + k;
        ctx.beginPath();
        ctx.arc(x + Math.cos(pa) * r * 0.8, y + Math.sin(pa) * r * 0.8, r * 0.62, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#f4a300";
      ctx.beginPath();
      ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

/* ---- hands --------------------------------------------------------------- */

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = i % 2 ? r * 0.28 : r;
    ctx.lineTo(x + Math.cos(a - Math.PI / 2) * rr, y + Math.sin(a - Math.PI / 2) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.45, y - s * 1.05, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35);
  ctx.fill();
}

function drawHand(ctx: CanvasRenderingContext2D, id: string, p: (i: number) => P, t: number) {
  const size = dist(p(0), p(9));
  const tips = [4, 8, 12, 16, 20];
  if (id === "sparkle") {
    ctx.shadowColor = "rgba(255,240,190,.95)";
    ctx.shadowBlur = size * 0.25;
    tips.forEach((i, k) => {
      const tw = 0.65 + 0.35 * Math.sin(t * 7 + k * 1.7);
      const q = p(i);
      ctx.fillStyle = k % 2 ? "#fff6d6" : "#ffffff";
      star(ctx, q.x, q.y - size * 0.08, size * 0.34 * tw);
      ctx.fillStyle = "rgba(255,230,150,.9)";
      star(ctx, q.x + size * 0.22, q.y - size * 0.3, size * 0.13 * (1.3 - tw));
    });
    return;
  }
  // hearts float up from the index fingertip and the thumb
  ctx.shadowColor = "rgba(255,80,120,.55)";
  ctx.shadowBlur = size * 0.12;
  for (const [i, off] of [[8, 0], [4, 0.5]] as const) {
    const q = p(i);
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.55 + k / 3 + off) % 1;
      ctx.globalAlpha = Math.sin(ph * Math.PI);
      ctx.fillStyle = k === 1 ? "#ff8fab" : "#ff4d6d";
      heart(ctx, q.x + Math.sin((ph + k) * 6) * size * 0.12, q.y - ph * size * 1.3, size * (0.22 + 0.1 * (1 - ph)));
    }
  }
  ctx.globalAlpha = 1;
}

/* ---- body ---------------------------------------------------------------- */

function drawPose(ctx: CanvasRenderingContext2D, id: string, p: (i: number) => P, t: number) {
  const sA = p(12); // shoulder on the image's left
  const sB = p(11);
  const sw = dist(sA, sB);
  const ang = Math.atan2(sB.y - sA.y, sB.x - sA.x);
  const neck = lerp(mid(sA, sB), mid(p(9), p(10)), 0.32);

  if (id === "bowtie") {
    ctx.translate(neck.x, neck.y);
    ctx.rotate(ang);
    const bw = sw * 0.22;
    const bh = sw * 0.13;
    const g = ctx.createLinearGradient(0, -bh, 0, bh);
    g.addColorStop(0, "#2b2b31");
    g.addColorStop(0.5, "#0c0c0e");
    g.addColorStop(1, "#1c1c21");
    ctx.fillStyle = g;
    for (const sg of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(sg * bw * 0.5, -bh * 1.25, sg * bw, -bh);
      ctx.quadraticCurveTo(sg * bw * 1.12, 0, sg * bw, bh);
      ctx.quadraticCurveTo(sg * bw * 0.5, bh * 1.25, 0, 0);
      ctx.fill();
    }
    ctx.fillStyle = "#1f1f24";
    ctx.beginPath();
    ctx.ellipse(0, 0, bw * 0.22, bh * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.14)";
    ctx.beginPath();
    ctx.ellipse(-bw * 0.55, -bh * 0.45, bw * 0.3, bh * 0.12, -0.3, 0, Math.PI * 2);
    ctx.ellipse(bw * 0.55, -bh * 0.45, bw * 0.3, bh * 0.12, 0.3, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // wings: layered feathers fanning out from each shoulder
  const flap = Math.sin(t * 2.2) * 0.06;
  for (const [s, sg] of [[sA, -1], [sB, 1]] as const) {
    ctx.save();
    ctx.translate(s.x - sg * sw * 0.08, s.y - sw * 0.04);
    ctx.rotate(ang + sg * flap);
    ctx.shadowColor = "rgba(0,0,0,.25)";
    ctx.shadowBlur = sw * 0.04;
    for (let row = 0; row < 3; row++) {
      const n = 7 - row * 2;
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + sg * (0.25 + (k / (n - 1 || 1)) * 1.25);
        const len = sw * (0.95 - row * 0.25) * (1 - k * 0.05);
        ctx.save();
        ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = row === 0 ? "#f6f6f8" : row === 1 ? "#ffffff" : "#ececf0";
        ctx.beginPath();
        ctx.ellipse(0, -len / 2, sw * (0.07 - row * 0.01), len / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }
}
