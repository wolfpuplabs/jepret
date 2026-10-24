import { NextResponse } from "next/server";
import { getRollBySlug } from "@/lib/rolls";
import { setOwnerCookie, verifyOwnerToken } from "@/lib/auth";

export const runtime = "nodejs";

/** Owner link: /k/<slug>/<token>. Restores ownership on this device, then opens the roll. */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await ctx.params;
  const roll = await getRollBySlug(slug);
  const origin = new URL(req.url).origin;
  if (roll && (await verifyOwnerToken(roll, token))) await setOwnerCookie(roll.id, token);
  return NextResponse.redirect(new URL(`/r/${encodeURIComponent(slug)}`, origin));
}
