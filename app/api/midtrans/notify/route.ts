import { NextResponse } from "next/server";
import { applyStatus, verifySignature } from "@/lib/payments";

export const runtime = "nodejs";

/**
 * Midtrans HTTP notification (webhook).
 * Set "Payment Notification URL" in the Midtrans dashboard to
 *   https://<your-domain>/api/midtrans/notify
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!verifySignature(body)) return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
  try {
    const result = await applyStatus(body);
    // Unknown order ids (e.g. Midtrans test notifications) are acknowledged so they aren't retried.
    return NextResponse.json({ ok: true, status: result?.status ?? "ignored" });
  } catch (err) {
    console.error("midtrans notify", err);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
