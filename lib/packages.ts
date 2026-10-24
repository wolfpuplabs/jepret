/**
 * Film roll packages. A roll is a fixed number of exposures; developing is free,
 * the price is paid once to download the whole developed roll.
 * Prices can be overridden with ROLL_PRICES="mini:9000,classic:19000,…".
 */
export type Mode = "personal" | "event";
export type Pack = {
  id: string;
  mode: Mode;
  exposures: number;
  price: number;
  name: { id: string; en: string };
  note: { id: string; en: string };
  iso: number;
  color: string;
};

const BASE: Pack[] = [
  { id: "mini", mode: "personal", exposures: 10, price: 9000, iso: 200, color: "#ffc53d",
    name: { id: "Roll 10", en: "Roll 10" }, note: { id: "Cukup untuk satu momen", en: "Just enough for one moment" } },
  { id: "classic", mode: "personal", exposures: 25, price: 19000, iso: 400, color: "#ff8a3d",
    name: { id: "Roll 25", en: "Roll 25" }, note: { id: "Paling pas untuk jalan-jalan", en: "Perfect for a day out" } },
  { id: "pro", mode: "personal", exposures: 36, price: 25000, iso: 800, color: "#ff5a36",
    name: { id: "Roll 36", en: "Roll 36" }, note: { id: "Rol penuh seperti film asli", en: "A full roll, like real film" } },
  { id: "party", mode: "event", exposures: 100, price: 49000, iso: 400, color: "#7bd389",
    name: { id: "Party 100", en: "Party 100" }, note: { id: "Arisan, ulang tahun, kumpul kecil", en: "Birthdays and small get-togethers" } },
  { id: "fiesta", mode: "event", exposures: 250, price: 99000, iso: 800, color: "#5ec2ff",
    name: { id: "Party 250", en: "Party 250" }, note: { id: "Lamaran, gathering kantor", en: "Engagements, team gatherings" } },
  { id: "gala", mode: "event", exposures: 500, price: 179000, iso: 1600, color: "#c792ff",
    name: { id: "Party 500", en: "Party 500" }, note: { id: "Pernikahan dan pesta besar", en: "Weddings and big parties" } },
];

function overrides() {
  const raw = process.env.ROLL_PRICES || process.env.NEXT_PUBLIC_ROLL_PRICES || "";
  const m = new Map<string, number>();
  for (const part of raw.split(",")) {
    const [k, v] = part.split(":").map((s) => s.trim());
    const n = Math.round(Number(v));
    if (k && Number.isFinite(n) && n >= 1000) m.set(k, n);
  }
  return m;
}

export function packages(): Pack[] {
  const o = overrides();
  return BASE.map((p) => ({ ...p, price: o.get(p.id) ?? p.price }));
}

export const getPack = (id: string) => packages().find((p) => p.id === id) ?? null;

export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

/* develop timing --------------------------------------------------------- */
export type DevelopMode = "instant" | "hour" | "morning";
export const DEVELOP_MODES: DevelopMode[] = ["instant", "hour", "morning"];

/** When a roll that finished at `base` comes out of the lab. "morning" = next 09:00 WIB. */
export function developTime(base: Date, mode: DevelopMode) {
  if (mode === "instant") return new Date(base.getTime() + 60_000);
  if (mode === "hour") return new Date(base.getTime() + 3600_000);
  const wib = new Date(base.getTime() + 7 * 3600_000); // shift to UTC+7 wall clock
  const next = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate(), 9, 0, 0));
  if (next.getTime() <= wib.getTime() + 30 * 60_000) next.setUTCDate(next.getUTCDate() + 1);
  return new Date(next.getTime() - 7 * 3600_000);
}
