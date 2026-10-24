/**
 * jepret film looks. Each look is applied pixel-by-pixel on a canvas so the
 * result is identical on every browser (Safari has no canvas `filter`).
 * `css` is only an approximation used for the live camera preview.
 */
export type Look = {
  id: string;
  name: { id: string; en: string };
  note: { id: string; en: string };
  swatch: [string, string];
  css: string;
  /** optional CSS background drawn over the live preview (flash hot-spot, light leak, vignette) */
  overlay?: string;
  p: {
    exposure: number;
    contrast: number;
    saturation: number;
    warmth: number; // + warmer, - cooler (0..255 units)
    tint: number; // + magenta, - green
    fade: number; // 0..0.25 lifts blacks
    shadows: [number, number, number];
    highlights: [number, number, number];
    mono: boolean;
    grain: number; // 0..40
    vignette: number; // 0..0.8
    flash: number; // 0..1 bright on-camera flash hot-spot in the centre
    leak: null | { side: "left" | "right"; color: [number, number, number]; strength: number }; // light leak
  };
};

const base: Look["p"] = {
  exposure: 1,
  contrast: 1,
  saturation: 1,
  warmth: 0,
  tint: 0,
  fade: 0,
  shadows: [0, 0, 0],
  highlights: [0, 0, 0],
  mono: false,
  grain: 0,
  vignette: 0,
  flash: 0,
  leak: null,
};

const VIG = (a: number) => `radial-gradient(ellipse at 50% 50%, transparent 48%, rgba(0,0,0,${a}) 100%)`;

export const LOOKS: Look[] = [
  {
    id: "pagi",
    name: { id: "Pagi", en: "Morning" },
    note: { id: "Hangat, lembut, kulit tampak cerah", en: "Warm, soft, glowing skin" },
    swatch: ["#f6c48f", "#e98d5a"],
    css: "sepia(0.18) saturate(1.1) contrast(0.95) brightness(1.06)",
    p: { ...base, exposure: 1.05, contrast: 0.94, saturation: 1.08, warmth: 12, fade: 0.06, shadows: [10, 2, -6], highlights: [8, 4, -6], grain: 10, vignette: 0.25 },
  },
  {
    id: "flash",
    name: { id: "Blitz", en: "Flash" },
    note: { id: "Kilat langsung, wajah terang, latar gelap", en: "Direct flash, bright faces, dark background" },
    swatch: ["#ffffff", "#2a2a33"],
    css: "contrast(1.22) brightness(1.08) saturate(1.08)",
    overlay: `radial-gradient(ellipse at 50% 42%, rgba(255,255,255,.2), transparent 55%), ${VIG(0.55)}`,
    p: { ...base, exposure: 1.04, contrast: 1.22, saturation: 1.08, warmth: -4, shadows: [-4, -2, 4], highlights: [10, 10, 12], grain: 12, vignette: 0.55, flash: 0.45 },
  },
  {
    id: "film35",
    name: { id: "35mm", en: "35mm" },
    note: { id: "Seperti rol film klasik: hangat, lembut, berbutir halus", en: "Classic film roll: warm, soft, fine grain" },
    swatch: ["#f1d3a4", "#6f8a8c"],
    css: "sepia(0.12) saturate(0.95) contrast(0.96) brightness(1.04)",
    overlay: VIG(0.25),
    p: { ...base, exposure: 1.03, contrast: 0.96, saturation: 0.92, warmth: 8, tint: 3, fade: 0.08, shadows: [-2, 4, 10], highlights: [12, 6, -8], grain: 16, vignette: 0.2 },
  },
  {
    id: "disposable",
    name: { id: "Sekali Pakai", en: "Disposable" },
    note: { id: "Kamera sekali pakai: hijau, pekat, bocor cahaya", en: "Throwaway camera: green cast, punchy, light leak" },
    swatch: ["#ff8a3c", "#3f5d3a"],
    css: "contrast(1.15) saturate(1.25) brightness(1.05) hue-rotate(-6deg)",
    overlay: `linear-gradient(90deg, transparent 60%, rgba(255,110,40,.3)), radial-gradient(ellipse at 50% 42%, rgba(255,255,255,.1), transparent 55%), ${VIG(0.6)}`,
    p: { ...base, exposure: 1.05, contrast: 1.15, saturation: 1.2, warmth: 6, tint: -8, fade: 0.05, shadows: [-6, 8, 0], highlights: [10, 8, -10], grain: 22, vignette: 0.6, flash: 0.25, leak: { side: "right", color: [255, 110, 40], strength: 0.38 } },
  },
  {
    id: "eighties",
    name: { id: "1980-an", en: "1980s" },
    note: { id: "Pudar, hangat kemerahan, vibe album keluarga", en: "Faded, warm magenta, family-album vibe" },
    swatch: ["#f4a6a0", "#7a4b78"],
    css: "sepia(0.25) saturate(1.1) contrast(0.88) brightness(1.06) hue-rotate(-12deg)",
    overlay: `linear-gradient(270deg, transparent 62%, rgba(255,60,90,.22)), ${VIG(0.3)}`,
    p: { ...base, exposure: 1.04, contrast: 0.88, saturation: 1.05, warmth: 14, tint: 10, fade: 0.16, shadows: [8, -2, 14], highlights: [16, 4, -6], grain: 18, vignette: 0.3, leak: { side: "left", color: [255, 60, 90], strength: 0.26 } },
  },
  {
    id: "cinema",
    name: { id: "Sinema", en: "Cinema" },
    note: { id: "Bayangan teal, kulit oranye, kontras film", en: "Teal shadows, orange skin, movie contrast" },
    swatch: ["#f2a65a", "#1f5f6b"],
    css: "contrast(1.12) saturate(1.15) sepia(0.1) hue-rotate(-4deg)",
    overlay: VIG(0.35),
    p: { ...base, contrast: 1.12, saturation: 1.1, warmth: 4, fade: 0.04, shadows: [-12, 6, 18], highlights: [18, 6, -14], grain: 8, vignette: 0.35 },
  },
  {
    id: "instant",
    name: { id: "Instan", en: "Instant" },
    note: { id: "Foto instan: lembut, pudar, highlight krem", en: "Instant print: soft, faded, creamy highlights" },
    swatch: ["#f3ead6", "#8fa7b3"],
    css: "contrast(0.86) saturate(0.85) brightness(1.08) sepia(0.08)",
    overlay: VIG(0.25),
    p: { ...base, exposure: 1.06, contrast: 0.86, saturation: 0.85, warmth: 4, tint: 2, fade: 0.18, shadows: [-4, 6, 14], highlights: [10, 8, 0], grain: 10, vignette: 0.25 },
  },
  {
    id: "senja",
    name: { id: "Senja", en: "Dusk" },
    note: { id: "Oranye keemasan, warna pekat", en: "Golden orange, rich colour" },
    swatch: ["#ff9f5a", "#b23a48"],
    css: "sepia(0.25) saturate(1.45) contrast(1.08) hue-rotate(-8deg)",
    p: { ...base, exposure: 1.02, contrast: 1.1, saturation: 1.35, warmth: 20, tint: 6, fade: 0.03, shadows: [14, -4, 4], highlights: [16, 6, -14], grain: 12, vignette: 0.35 },
  },
  {
    id: "teduh",
    name: { id: "Teduh", en: "Shade" },
    note: { id: "Sejuk, pudar, bayangan kehijauan", en: "Cool, faded, green shadows" },
    swatch: ["#9ec5b8", "#4d6f7a"],
    css: "saturate(0.8) contrast(0.9) brightness(1.04) hue-rotate(10deg)",
    p: { ...base, exposure: 1.03, contrast: 0.9, saturation: 0.82, warmth: -10, tint: -6, fade: 0.12, shadows: [-6, 10, 8], highlights: [4, 4, 0], grain: 14, vignette: 0.2 },
  },
  {
    id: "kopi",
    name: { id: "Kopi", en: "Coffee" },
    note: { id: "Cokelat klasik, nuansa album lama", en: "Classic brown, old-album feel" },
    swatch: ["#c9a27e", "#5b3a29"],
    css: "sepia(0.45) saturate(0.85) contrast(1.02)",
    p: { ...base, contrast: 1.02, saturation: 0.7, warmth: 18, fade: 0.1, shadows: [16, 6, -8], highlights: [14, 8, -12], grain: 18, vignette: 0.4 },
  },
  {
    id: "arang",
    name: { id: "Arang", en: "Charcoal" },
    note: { id: "Hitam putih tegas, berbutir", en: "Punchy black & white, grainy" },
    swatch: ["#d8d8d8", "#1b1b1b"],
    css: "grayscale(1) contrast(1.35) brightness(1.02)",
    p: { ...base, contrast: 1.35, mono: true, grain: 26, vignette: 0.35 },
  },
  {
    id: "kabut",
    name: { id: "Kabut", en: "Mist" },
    note: { id: "Hitam putih lembut dan pudar", en: "Soft, faded black & white" },
    swatch: ["#ece7df", "#7c766e"],
    css: "grayscale(1) sepia(0.12) contrast(0.85) brightness(1.08)",
    p: { ...base, exposure: 1.06, contrast: 0.85, mono: true, fade: 0.14, shadows: [4, 2, 0], highlights: [6, 4, 0], grain: 16, vignette: 0.15 },
  },
  {
    id: "polos",
    name: { id: "Polos", en: "Natural" },
    note: { id: "Tanpa filter, apa adanya", en: "No filter, just as it is" },
    swatch: ["#cfd8e3", "#7a8ca3"],
    css: "none",
    p: { ...base },
  },
];

export const getLook = (id: string) => LOOKS.find((l) => l.id === id) ?? LOOKS[0];

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

export function applyLook(data: ImageData, look: Look) {
  const p = look.p;
  if (look.id === "polos") return;
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    let x = (i / 255) * p.exposure;
    x = (x - 0.5) * p.contrast + 0.5;
    x = p.fade + x * (1 - p.fade);
    lut[i] = clamp(x * 255);
  }
  const d = data.data;
  const w = data.width;
  const h = data.height;
  const cx = w / 2;
  const cy = h / 2;
  const maxD = Math.sqrt(cx * cx + cy * cy);
  const leak = p.leak;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = lut[d[i]];
      let g = lut[d[i + 1]];
      let b = lut[d[i + 2]];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (p.mono) {
        r = g = b = lum;
      } else if (p.saturation !== 1) {
        r = lum + (r - lum) * p.saturation;
        g = lum + (g - lum) * p.saturation;
        b = lum + (b - lum) * p.saturation;
      }
      const l = lum / 255;
      const sh = (1 - l) * (1 - l);
      const hi = l * l;
      r += p.warmth + sh * p.shadows[0] + hi * p.highlights[0] + p.tint * 0.5;
      g += sh * p.shadows[1] + hi * p.highlights[1] - p.tint;
      b += -p.warmth + sh * p.shadows[2] + hi * p.highlights[2] + p.tint * 0.5;
      if (p.grain) {
        const n = (Math.random() - 0.5) * p.grain;
        r += n;
        g += n;
        b += n;
      }
      if (p.vignette || p.flash) {
        const dx = x - cx;
        const dy = y - cy * 0.84; // flash sits a little above centre, on the faces
        const dist = Math.sqrt(dx * dx + dy * dy) / maxD;
        let v = 1 - p.vignette * dist * dist;
        if (p.flash) {
          const hot = Math.max(0, 1 - dist / 0.62);
          v *= 1 + p.flash * 0.38 * hot * hot;
        }
        r *= v;
        g *= v;
        b *= v;
      }
      if (leak) {
        const fx = x / w;
        let k = leak.side === "right" ? (fx - 0.58) / 0.42 : (0.42 - fx) / 0.42;
        if (k > 0) {
          k = k * k * leak.strength * (0.65 + 0.35 * (1 - y / h));
          r += (255 - r) * (leak.color[0] / 255) * k;
          g += (255 - g) * (leak.color[1] / 255) * k;
          b += (255 - b) * (leak.color[2] / 255) * k;
        }
      }
      d[i] = clamp(r);
      d[i + 1] = clamp(g);
      d[i + 2] = clamp(b);
    }
  }
}

/** Draws the orange date stamp in the bottom-right corner, like a pocket film camera. */
export function drawDateStamp(ctx: CanvasRenderingContext2D, w: number, h: number, date = new Date()) {
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const text = `'${yy}  ${mm}  ${dd}`;
  const size = Math.round(Math.min(w, h) * 0.045);
  ctx.save();
  ctx.font = `700 ${size}px "Courier New", ui-monospace, monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(255,120,30,0.9)";
  ctx.shadowBlur = size * 0.5;
  ctx.fillStyle = "#ffb15c";
  ctx.globalAlpha = 0.92;
  ctx.fillText(text, w - size * 1.2, h - size * 1.1);
  ctx.restore();
}
