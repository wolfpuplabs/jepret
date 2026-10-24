import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { finishRoll, getRollBySlug } from "@/lib/rolls";
import { isOwner } from "@/lib/auth";
import { deleteFiles } from "@/lib/storage";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ slug: string }> };

async function owned(slug: string) {
  const roll = await getRollBySlug(slug);
  if (!roll) return { roll: null, ok: false };
  return { roll, ok: await isOwner(roll) };
}

/** Owner actions: { action: "finish" } sends the roll to the lab now. */
export async function PATCH(req: Request, ctx: Ctx) {
  const { roll, ok } = await owned((await ctx.params).slug);
  if (!roll) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.action === "finish") {
    await finishRoll(roll.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}

/** Deletes the roll, its members, payments records and every photo file. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { roll, ok } = await owned((await ctx.params).slug);
  if (!roll) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const files = await query<{ url: string; thumb_url: string }>(`select url, thumb_url from photos where roll_id = $1`, [roll.id]);
  await deleteFiles(files.flatMap((f) => [f.url, f.thumb_url]));
  await query(`delete from rolls where id = $1`, [roll.id]);
  return NextResponse.json({ ok: true });
}
