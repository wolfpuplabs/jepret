import { NextResponse } from "next/server";
import { one } from "@/lib/db";
import { getRollBySlug, rollState } from "@/lib/rolls";
import { canView } from "@/lib/auth";
import { canDownload } from "@/lib/payments";
import { readFile } from "@/lib/storage";

export const runtime = "nodejs";

/** Full-resolution download — only for developed rolls that have been paid for. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await ctx.params;
  const roll = await getRollBySlug(slug);
  if (!roll) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (rollState(roll).phase !== "developed" || !(await canView(roll))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!canDownload(roll)) return NextResponse.json({ error: "payment_required" }, { status: 402 });
  const photo = await one<{ url: string }>(`select url from photos where id = $1 and roll_id = $2`, [id, roll.id]);
  if (!photo) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const file = await readFile(photo.url);
  if (!file) return NextResponse.json({ error: "missing" }, { status: 404 });
  return new NextResponse(file.body, {
    headers: {
      "content-type": file.type,
      "cache-control": "private, max-age=3600",
      "content-disposition": `attachment; filename="jepret-${id}.jpg"`,
    },
  });
}
