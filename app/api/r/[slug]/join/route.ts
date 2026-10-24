import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { hashToken, randomId, randomToken } from "@/lib/ids";
import { getRollBySlug, rollState, shotCount } from "@/lib/rolls";
import { currentMember, setMemberCookie } from "@/lib/auth";

export const runtime = "nodejs";

/** A guest joins an event roll with their name. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const roll = await getRollBySlug(slug);
  if (!roll || roll.mode !== "event") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (rollState(roll).phase !== "shooting") return NextResponse.json({ error: "ended" }, { status: 403 });
  if ((await shotCount(roll.id)) >= roll.exposures) return NextResponse.json({ error: "full" }, { status: 403 });
  if (await currentMember(roll)) return NextResponse.json({ ok: true });
  const { name } = await req.json().catch(() => ({ name: "" }));
  const clean = typeof name === "string" ? name.trim().slice(0, 40) : "";
  if (!clean) return NextResponse.json({ error: "name" }, { status: 400 });
  const token = randomToken();
  await query(`insert into members (id, roll_id, name, token_hash) values ($1,$2,$3,$4)`, [randomId(12), roll.id, clean, hashToken(token)]);
  await setMemberCookie(roll.id, token);
  return NextResponse.json({ ok: true });
}
