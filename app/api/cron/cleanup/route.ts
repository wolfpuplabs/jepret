import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { deleteFiles } from "@/lib/storage";
import { RETENTION_DAYS } from "@/lib/rolls";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH = 100; // blob deletions per call
const PAUSE_MS = 7000; // stays under the Hobby limit of 900 blob operations per minute
const BUDGET_MS = 240_000;

/**
 * Daily job (vercel.json): deletes rolls that finished more than RETENTION_DAYS
 * (+1 day for the lab delay) ago, and rolls abandoned unfinished for 90 days.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const expired = await query<{ id: string }>(
    `select id from rolls
      where coalesce(finished_at, ends_at) < now() - ($1 || ' days')::interval
         or (finished_at is null and ends_at is null and created_at < now() - interval '90 days')
      order by created_at asc`,
    [String(RETENTION_DAYS + 1)]
  );
  let photos = 0;
  let rolls = 0;
  let first = true;
  for (const r of expired) {
    while (Date.now() - started < BUDGET_MS) {
      const batch = await query<{ id: string; url: string; thumb_url: string }>(
        `select id, url, thumb_url from photos where roll_id = $1 limit $2`,
        [r.id, BATCH / 2]
      );
      if (!batch.length) break;
      if (!first) await new Promise((res) => setTimeout(res, PAUSE_MS));
      first = false;
      await deleteFiles(batch.flatMap((p) => [p.url, p.thumb_url]));
      await query(`delete from photos where id = any($1::text[])`, [batch.map((p) => p.id)]);
      photos += batch.length;
    }
    if (Date.now() - started >= BUDGET_MS) break;
    await query(`delete from rolls where id = $1`, [r.id]);
    rolls++;
  }
  console.log(`cleanup: ${rolls} rolls, ${photos} photos deleted, ${expired.length - rolls} pending`);
  return NextResponse.json({ rolls, photos, pending: expired.length - rolls });
}
