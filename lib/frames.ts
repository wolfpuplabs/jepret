"use client";
/**
 * Print frames added to photos at download time. Everything is drawn on a
 * canvas in the browser, so the stored originals never change.
 */
export type FrameId = "none" | "polaroid" | "film" | "postcard";

export const FRAMES: { id: FrameId; name: { id: string; en: string } }[] = [
  { id: "none", name: { id: "Tanpa", en: "None" } },
  { id: "polaroid", name: { id: "Polaroid", en: "Polaroid" } },
  { id: "film", name: { id: "Film", en: "Film strip" } },
  { id: "postcard", name: { id: "Kartu pos", en: "Postcard" } },
];

export type FrameMeta = { event: string; guest: string | null; date: Date; index: number };

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const MONO = '"DM Mono", ui-monospace, Menlo, monospace';

let fontsReady: Promise<unknown> | null = null;
function loadFonts() {
  if (!fontsReady && typeof document !== "undefined" && document.fonts) {
    fontsReady = Promise.all([
      document.fonts.load(`italic 48px ${SERIF}`),
      document.fonts.load(`48px ${SERIF}`),
      document.fonts.load(`500 48px ${MONO}`),
    ]).catch(() => null);
  }
  return fontsReady ?? Promise.resolve();
}

const dateText = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`;

/** Sets the font, shrinking it until `text` fits in `maxW`. */
function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, px: number, maxW: number) {
  let size = px;
  ctx.font = font(size);
  while (size > 8 && ctx.measureText(text).width > maxW) {
    size *= 0.92;
    ctx.font = font(size);
  }
  return size;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function decode(blob: Blob): Promise<{ img: CanvasImageSource; w: number; h: number }> {
  try {
    const bmp = await createImageBitmap(blob);
    return { img: bmp, w: bmp.width, h: bmp.height };
  } catch {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    await img.decode();
    URL.revokeObjectURL(url);
    return { img, w: img.naturalWidth, h: img.naturalHeight };
  }
}

export async function applyFrame(blob: Blob, frame: FrameId, meta: FrameMeta): Promise<Blob> {
  if (frame === "none") return blob;
  await loadFonts();
  const { img, w, h } = await decode(blob);
  const u = Math.min(w, h); // frame proportions follow the short side
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const guest = meta.guest?.trim() || "";
  const date = dateText(meta.date);

  if (frame === "polaroid") {
    const side = Math.round(u * 0.06);
    const bottom = Math.round(u * 0.26);
    c.width = w + side * 2;
    c.height = h + side + bottom;
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, "#f8f7f3");
    g.addColorStop(1, "#ecebe5");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, side, side, w, h);
    ctx.strokeStyle = "rgba(0,0,0,.08)";
    ctx.lineWidth = Math.max(1, u * 0.002);
    ctx.strokeRect(side, side, w, h);
    const cx = c.width / 2;
    const top = side + h;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#26262b";
    const main = guest || meta.event;
    fit(ctx, main, (px) => `italic ${px}px ${SERIF}`, bottom * 0.34, w * 0.9);
    ctx.fillText(main, cx, top + bottom * 0.52);
    const sub = (guest ? `${meta.event} · ${date}` : date).toUpperCase();
    ctx.fillStyle = "rgba(38,38,43,.5)";
    fit(ctx, sub, (px) => `500 ${px}px ${MONO}`, bottom * 0.1, w * 0.9);
    ctx.fillText(sub, cx, top + bottom * 0.77);
  } else if (frame === "film") {
    const side = Math.round(u * 0.04);
    const band = Math.round(u * 0.13);
    c.width = w + side * 2;
    c.height = h + band * 2;
    ctx.fillStyle = "#0c0b0a";
    ctx.fillRect(0, 0, c.width, c.height);
    // sprocket holes
    const hw = u * 0.034;
    const hh = u * 0.05;
    const gap = u * 0.075;
    ctx.fillStyle = "#d9d4c8";
    for (let x = gap * 0.4; x < c.width - hw; x += gap) {
      roundRect(ctx, x, band * 0.16, hw, hh, hw * 0.22);
      ctx.fill();
      roundRect(ctx, x, c.height - band * 0.16 - hh, hw, hh, hw * 0.22);
      ctx.fill();
    }
    ctx.save();
    roundRect(ctx, side, band, w, h, u * 0.012);
    ctx.clip();
    ctx.drawImage(img, side, band, w, h);
    ctx.restore();
    // edge print, like the numbers on a real roll
    ctx.fillStyle = "#ff9a3c";
    ctx.textBaseline = "middle";
    const ty = band * 0.62 + hh * 0.18;
    const by = c.height - band * 0.62 - hh * 0.18;
    const px = band * 0.17;
    ctx.font = `500 ${px}px ${MONO}`;
    ctx.textAlign = "left";
    ctx.fillText(`JEPRET 400`, side, ty);
    ctx.fillText(`▶ ${meta.index + 1}A`, side, by);
    ctx.textAlign = "right";
    ctx.fillText(`${meta.index + 1}`, c.width - side, ty);
    const right = `${guest ? guest.toUpperCase() + "  ·  " : ""}${date}`;
    fit(ctx, right, (p) => `500 ${p}px ${MONO}`, px, w * 0.6);
    ctx.fillText(right, c.width - side, by);
  } else {
    // postcard: cream mat, thin keyline, event name set like a printed card
    const side = Math.round(u * 0.08);
    const bottom = Math.round(u * 0.24);
    c.width = w + side * 2;
    c.height = h + side + bottom;
    ctx.fillStyle = "#f1ece2";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, side, side, w, h);
    ctx.strokeStyle = "#cfc6b4";
    ctx.lineWidth = Math.max(1, u * 0.003);
    const k = side * 0.45;
    ctx.strokeRect(side - k, side - k, w + k * 2, h + k * 2);
    const cx = c.width / 2;
    const top = side + h + k;
    ctx.textAlign = "center";
    ctx.fillStyle = "#1d1d20";
    fit(ctx, meta.event, (px) => `${px}px ${SERIF}`, bottom * 0.3, w * 0.9);
    ctx.fillText(meta.event, cx, top + (bottom - k) * 0.5);
    const sub = `${guest ? `by ${guest}  ·  ` : ""}${date}`.toUpperCase();
    ctx.fillStyle = "rgba(29,29,32,.55)";
    fit(ctx, sub, (px) => `500 ${px}px ${MONO}`, bottom * 0.085, w * 0.9);
    ctx.fillText(sub, cx, top + (bottom - k) * 0.75);
  }

  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.92));
}
