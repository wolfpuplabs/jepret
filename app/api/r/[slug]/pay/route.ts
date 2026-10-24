import { NextResponse } from "next/server";
import { limitByClient } from "@/lib/guard";
import { getRollBySlug, rollState } from "@/lib/rolls";
import { canView } from "@/lib/auth";
import { createPayment, getPayment, payConfig, refreshFromMidtrans } from "@/lib/payments";
import { siteOrigin } from "@/lib/i18n-server";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ slug: string }> };

/** Starts a Snap payment for the whole roll. */
export async function POST(req: Request, ctx: Ctx) {
  const limited = await limitByClient(req, "pay", 15, 600);
  if (limited) return limited;
  const roll = await getRollBySlug((await ctx.params).slug);
  if (!roll) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!(await canView(roll))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (rollState(roll).phase !== "developed") return NextResponse.json({ error: "not_developed" }, { status: 409 });
  if (!payConfig().enabled || roll.paid) return NextResponse.json({ unlocked: true });
  try {
    const p = await createPayment(roll, await siteOrigin(), `/r/${roll.slug}/album`);
    return NextResponse.json(p);
  } catch {
    return NextResponse.json({ error: "payment_unavailable" }, { status: 502 });
  }
}

/** Polls an order; asks Midtrans while it is still pending. */
export async function GET(req: Request, ctx: Ctx) {
  const roll = await getRollBySlug((await ctx.params).slug);
  if (!roll) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const limited = await limitByClient(req, "pay-poll", 200, 600);
  if (limited) return limited;
  const order = new URL(req.url).searchParams.get("order") || "";
  let pay = await getPayment(order, roll.id);
  if (!pay) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (pay.status === "pending" && payConfig().enabled) {
    await refreshFromMidtrans(order).catch(() => null);
    pay = (await getPayment(order, roll.id)) ?? pay;
  }
  const fresh = await getRollBySlug(roll.slug);
  return NextResponse.json({ status: pay.status, unlocked: !!fresh?.paid });
}
