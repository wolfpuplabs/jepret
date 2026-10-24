import { NextResponse } from "next/server";
import { one, query } from "@/lib/db";
import { randomId } from "@/lib/ids";
import { finishRoll, getRollBySlug, rollState, shotCount } from "@/lib/rolls";
import { currentMember } from "@/lib/auth";
import { deleteFiles, saveFile } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_FULL = 4 * 1024 * 1024; // under the 4.5 MB serverless body limit
const MAX_THUMB = 500 * 1024;

/** Saves one exposure. The roll is shared, so the count is checked atomically. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const roll = await getRollBySlug(slug);
  if (!roll) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const member = await currentMember(roll);
  if (!member) return NextResponse.json({ error: "not_joined" }, { status: 401 });
  if (rollState(roll).phase !== "shooting") return NextResponse.json({ error: "ended" }, { status: 403 });
  if ((await shotCount(roll.id)) >= roll.exposures) return NextResponse.json({ error: "roll_done", left: 0 }, { status: 403 });

  const form = await req.formData();
  const full = form.get("full");
  const thumb = form.get("thumb");
  const source = form.get("source") === "upload" ? "upload" : "camera";
  if (!(full instanceof Blob) || !(thumb instanceof Blob) || !full.size || !thumb.size) {
    return NextResponse.json({ error: "file" }, { status: 400 });
  }
  if (full.size > MAX_FULL || thumb.size > MAX_THUMB) return NextResponse.json({ error: "too_big" }, { status: 413 });

  const folder = `rolls/${roll.id}`;
  const [f, t] = await Promise.all([
    saveFile(folder, "jpg", full, "image/jpeg"),
    saveFile(`${folder}/thumbs`, "jpg", thumb, "image/jpeg"),
  ]);

  const id = randomId(12);
  const inserted = await query<{ id: string }>(
    `insert into photos (id, roll_id, member_id, member_name, url, thumb_url, width, height, source)
     select $1,$2,$3,$4,$5,$6,$7,$8,$9
      where (select count(*) from photos where roll_id = $2) < $10
     returning id`,
    [id, roll.id, member.id, member.name, f.url, t.url, Number(form.get("width")) || null, Number(form.get("height")) || null, source, roll.exposures]
  );
  if (!inserted.length) {
    await deleteFiles([f.url, t.url]);
    await finishRoll(roll.id);
    return NextResponse.json({ error: "roll_done", left: 0 }, { status: 403 });
  }
  const used = await shotCount(roll.id);
  if (used >= roll.exposures) await finishRoll(roll.id);
  const mine = await one<{ n: number }>(`select count(*)::int as n from photos where member_id = $1`, [member.id]);
  return NextResponse.json({ ok: true, left: Math.max(0, roll.exposures - used), mine: Number(mine?.n ?? 0) });
}
