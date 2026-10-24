"use client";
import { applyLook, drawDateStamp, getLook } from "./filters";
import { applyFrame, type FrameId } from "./frames";

export type Processed = { full: Blob; thumb: Blob; width: number; height: number };

const toBlob = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", q));

/**
 * Renders a source (video frame, bitmap or image) into a filtered JPEG plus a
 * small thumbnail. Everything happens on the device; only the result is uploaded.
 */
export async function developFrame(
  source: CanvasImageSource,
  sw: number,
  sh: number,
  opts: { look: string; stamp: boolean; mirror?: boolean; maxSide?: number; date?: Date; zoom?: number; overlay?: CanvasImageSource | null }
): Promise<Processed> {
  const maxSide = opts.maxSide ?? 1600;
  // digital zoom: keep the centre 1/zoom of the frame, like the viewfinder shows
  const z = Math.max(1, opts.zoom ?? 1);
  const cw = sw / z;
  const ch = sh / z;
  const scale = Math.min(1, maxSide / Math.max(cw, ch));
  const w = Math.round(cw * scale);
  const h = Math.round(ch * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  if (opts.mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h);
  // AR accessories are drawn in the same frame coordinates, so they get the same crop, mirror and film look
  if (opts.overlay) ctx.drawImage(opts.overlay, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  applyLook(img, getLook(opts.look));
  ctx.putImageData(img, 0, 0);
  if (opts.stamp) drawDateStamp(ctx, w, h, opts.date);

  const tScale = Math.min(1, 720 / Math.max(w, h));
  const tc = document.createElement("canvas");
  tc.width = Math.round(w * tScale);
  tc.height = Math.round(h * tScale);
  tc.getContext("2d")!.drawImage(c, 0, 0, tc.width, tc.height);

  const [full, thumb] = await Promise.all([toBlob(c, 0.82), toBlob(tc, 0.72)]);
  return { full, thumb, width: w, height: h };
}

export async function loadImageFile(file: File): Promise<{ src: CanvasImageSource; w: number; h: number; date?: Date }> {
  const date = file.lastModified ? new Date(file.lastModified) : undefined;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { src: bmp, w: bmp.width, h: bmp.height, date };
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, date };
  }
}

/** Resizes a cover image without any film look. */
export async function prepareCover(file: File): Promise<Blob> {
  const { src, w, h } = await loadImageFile(file);
  const scale = Math.min(1, 1600 / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return toBlob(c, 0.85);
}

export async function saveBlob(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const mobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  if (mobile && blob.type.startsWith("image/") && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function downloadPhotos(
  slug: string,
  photos: { id: string; guestName: string | null; createdAt?: string; frameNo?: number }[],
  zipName: string,
  onProgress?: (done: number, total: number) => void,
  framing?: { frame: FrameId; eventName: string }
) {
  const order = new Map(photos.map((p, i) => [p.id, i]));
  const fetchOne = async (id: string) => {
    const r = await fetch(`/api/r/${slug}/photos/${id}/file`);
    if (r.status === 402) throw new Error("payment_required");
    if (!r.ok) throw new Error("download");
    const blob = await r.blob();
    if (!framing || framing.frame === "none") return blob;
    const p = photos[order.get(id) ?? 0];
    return applyFrame(blob, framing.frame, {
      event: framing.eventName,
      guest: p.guestName,
      date: p.createdAt ? new Date(p.createdAt) : new Date(),
      index: p.frameNo ?? order.get(id) ?? 0,
    });
  };
  const name = (p: { id: string; guestName: string | null }, i: number) => {
    const who = (p.guestName || "guest").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "guest";
    return `${String(i + 1).padStart(3, "0")}-${who}-${p.id}.jpg`;
  };
  if (photos.length === 1) {
    await saveBlob(await fetchOne(photos[0].id), name(photos[0], 0));
    return;
  }
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  let done = 0;
  const queue = photos.map((p, i) => ({ p, i }));
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const { p, i } = queue.shift()!;
      zip.file(name(p, i), await fetchOne(p.id));
      onProgress?.(++done, photos.length);
    }
  });
  await Promise.all(workers);
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  await saveBlob(blob, zipName);
}
