import "server-only";
import { one, query } from "./db";
import { randomId } from "./ids";
import { developTime, type DevelopMode, type Mode } from "./packages";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type RollData = {
  id: string;
  slug: string;
  mode: Mode;
  packageId: string;
  exposures: number;
  price: number;
  name: string;
  ownerName: string | null;
  look: string;
  guestLooks: boolean;
  dateStamp: boolean;
  developMode: DevelopMode;
  endsAt: string | null;
  finishedAt: string | null;
  paid: boolean;
  createdAt: string;
};

export type PhotoData = {
  id: string;
  guestId: string | null;
  guestName: string | null;
  url: string;
  thumbUrl: string;
  createdAt: string;
};

export type Phase = "shooting" | "developing" | "developed";

const iso = (v: any) => (v ? new Date(v).toISOString() : null);

export function mapRoll(r: any): RollData {
  return {
    id: r.id,
    slug: r.slug,
    mode: r.mode === "event" ? "event" : "personal",
    packageId: r.package,
    exposures: Number(r.exposures),
    price: Number(r.price),
    name: r.name,
    ownerName: r.owner_name,
    look: r.look,
    guestLooks: r.guest_looks !== false,
    dateStamp: !!r.date_stamp,
    developMode: (["instant", "hour", "morning"].includes(r.develop_mode) ? r.develop_mode : "hour") as DevelopMode,
    endsAt: iso(r.ends_at),
    finishedAt: iso(r.finished_at),
    paid: !!r.paid,
    createdAt: iso(r.created_at)!,
  };
}

export async function getRollBySlug(slug: string) {
  const r = await one(`select * from rolls where slug = $1`, [slug.toLowerCase()]);
  return r ? mapRoll(r) : null;
}

/** Where the roll is in its life: still shooting, at the lab, or developed. */
export function rollState(r: RollData, now = Date.now()) {
  const ends = r.endsAt ? new Date(r.endsAt).getTime() : null;
  const base = r.finishedAt ? new Date(r.finishedAt) : ends !== null && now >= ends ? new Date(ends) : null;
  if (!base) return { phase: "shooting" as Phase, finishedAt: null, developAt: null };
  const dev = developTime(base, r.developMode);
  return {
    phase: (now >= dev.getTime() ? "developed" : "developing") as Phase,
    finishedAt: base.toISOString(),
    developAt: dev.toISOString(),
  };
}

/** Exposures used (reserved) on a roll — the counter the upload route enforces. */
export async function shotCount(rollId: string) {
  const r = await one<{ n: number }>(`select coalesce(shots_used, 0)::int as n from rolls where id = $1`, [rollId]);
  return Number(r?.n ?? 0);
}

export async function memberShots(memberId: string) {
  const r = await one<{ n: number }>(`select count(*)::int as n from photos where member_id = $1`, [memberId]);
  return Number(r?.n ?? 0);
}

export async function memberCount(rollId: string) {
  const r = await one<{ n: number }>(`select count(*)::int as n from members where roll_id = $1`, [rollId]);
  return Number(r?.n ?? 0);
}

export async function listPhotos(rollId: string): Promise<PhotoData[]> {
  const rows = await query(`select * from photos where roll_id = $1 order by created_at asc`, [rollId]);
  return rows.map((p: any) => ({
    id: p.id,
    guestId: p.member_id,
    guestName: p.member_name,
    url: p.url,
    thumbUrl: p.thumb_url,
    createdAt: iso(p.created_at)!,
  }));
}

/** Ends shooting now (roll full, or the owner sent it to the lab early). */
export async function finishRoll(rollId: string) {
  await query(`update rolls set finished_at = now() where id = $1 and finished_at is null`, [rollId]);
}

export function makeSlug(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return `${base || "roll"}-${randomId(4)}`;
}

/** Photos are kept this many days after the roll develops (paid rolls). */
export const RETENTION_DAYS = 30;
/** Rolls nobody paid for are cleared sooner: storage is the main variable cost. */
export const UNPAID_RETENTION_DAYS = 7;
export const retentionDays = (paid: boolean) => (paid ? RETENTION_DAYS : UNPAID_RETENTION_DAYS);
export const expiresAt = (developAt: string, paid = true) =>
  new Date(new Date(developAt).getTime() + retentionDays(paid) * 86400_000).toISOString();
