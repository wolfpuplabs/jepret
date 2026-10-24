import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { hashToken } from "./ids";
import { one, query } from "./db";

/**
 * Guardrails shared by the API routes: a small database-backed rate limiter,
 * JPEG checks for uploads and a durable metrics log for the ROI dashboard.
 */

/** Hashed client address — raw IPs are never stored. */
export async function clientKey(req?: Request) {
  const h = req ? req.headers : await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return hashToken(`${process.env.RATE_SALT || process.env.CRON_SECRET || "jp"}:${ip}`).slice(0, 24);
}

/**
 * Fixed-window counter. Returns false once `max` calls were made in the current
 * window. Fails open if the database is unreachable (the request would fail anyway).
 */
export async function allow(name: string, key: string, max: number, windowSec: number) {
  try {
    const bucket = Math.floor(Date.now() / 1000 / windowSec);
    const row = await one<{ n: number }>(
      `insert into rate_limits (k, bucket, n, expires_at) values ($1, $2, 1, now() + ($3 || ' seconds')::interval)
       on conflict (k, bucket) do update set n = rate_limits.n + 1
       returning n`,
      [`${name}:${key}`, bucket, String(windowSec * 2)]
    );
    return Number(row?.n ?? 0) <= max;
  } catch (err) {
    console.error("rate limit", err);
    return true;
  }
}

export const tooMany = () =>
  NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });

/** Rate-limits by client address; returns a 429 response when over the limit. */
export async function limitByClient(req: Request, name: string, max: number, windowSec: number, extra = "") {
  const key = (await clientKey(req)) + (extra ? `:${extra}` : "");
  return (await allow(name, key, max, windowSec)) ? null : tooMany();
}

/** True when the blob starts with the JPEG SOI marker (FF D8 FF). */
export async function isJpeg(b: Blob) {
  const a = new Uint8Array(await b.slice(0, 3).arrayBuffer());
  return a.length === 3 && a[0] === 0xff && a[1] === 0xd8 && a[2] === 0xff;
}

export type Metric = "created" | "joined" | "photo" | "paid" | "refunded" | "download" | "paywall";

/** Appends to the metrics log. Never throws: metrics must not break a request. */
export async function track(name: Metric, ref: string | null, amount = 0, bytes = 0) {
  try {
    await query(`insert into metrics (name, ref, amount, bytes) values ($1, $2, $3, $4)`, [name, ref, Math.round(amount), Math.round(bytes)]);
  } catch (err) {
    console.error("metric", err);
  }
}

/** Housekeeping for the daily cron. */
export async function pruneRateLimits() {
  await query(`delete from rate_limits where expires_at < now()`);
}
