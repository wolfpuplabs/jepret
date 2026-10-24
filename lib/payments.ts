import "server-only";
import { createHash } from "node:crypto";
import { one, query } from "./db";
import { randomId } from "./ids";
import type { RollData } from "./rolls";

/**
 * A developed roll is downloaded after one payment of its package price
 * (Midtrans Snap: GoPay + QRIS). One payment unlocks the roll for everyone in it.
 * Without Midtrans keys the paywall is off and downloads are free.
 */

export function payConfig() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
  const clientKey = process.env.MIDTRANS_CLIENT_KEY || "";
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const snapHost = isProduction ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
  const apiHost = isProduction ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
  return {
    enabled: !!serverKey && !!clientKey,
    serverKey,
    clientKey,
    isProduction,
    snapUrl: process.env.MIDTRANS_SNAP_URL || `${snapHost}/snap/v1/transactions`,
    apiUrl: process.env.MIDTRANS_API_URL || apiHost,
    snapJs: `${snapHost}/snap/snap.js`,
  };
}

/** What the browser needs to open the payment sheet (no secrets). */
export function publicPayConfig() {
  const c = payConfig();
  return { enabled: c.enabled, clientKey: c.clientKey, snapJs: c.snapJs };
}
export type PublicPayConfig = ReturnType<typeof publicPayConfig>;

export const canDownload = (roll: RollData) => !payConfig().enabled || roll.paid;

const auth = (serverKey: string) => "Basic " + Buffer.from(`${serverKey}:`).toString("base64");

export async function createPayment(roll: RollData, origin: string, returnPath: string) {
  const c = payConfig();
  const amount = roll.price;
  const orderId = `JPR-${roll.id.slice(0, 8)}-${randomId(10)}`.toUpperCase();
  await query(`insert into payments (order_id, roll_id, amount) values ($1,$2,$3)`, [orderId, roll.id, amount]);

  const finish = `${origin}${returnPath}${returnPath.includes("?") ? "&" : "?"}order=${encodeURIComponent(orderId)}`;
  const res = await fetch(c.snapUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: auth(c.serverKey),
      // this app may share a Midtrans account with others: send this order's notifications here
      "X-Override-Notification": `${origin}/api/midtrans/notify`,
    },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: amount },
      item_details: [{ id: `jepret-${roll.packageId}`, price: amount, quantity: 1, name: `Roll ${roll.exposures} · ${roll.name}`.slice(0, 50) }],
      enabled_payments: ["gopay", "other_qris"],
      callbacks: { finish },
      expiry: { unit: "minutes", duration: 30 },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { token?: string; redirect_url?: string; error_messages?: string[] };
  if (!res.ok || !data.token) {
    await query(`update payments set status = 'failed' where order_id = $1`, [orderId]);
    console.error("midtrans snap error", res.status, data.error_messages);
    throw new Error("snap");
  }
  await query(`update payments set snap_token = $2 where order_id = $1`, [orderId, data.token]);
  return { orderId, token: data.token, redirectUrl: data.redirect_url ?? null, amount };
}

type MidtransStatus = {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  transaction_status?: string;
  fraud_status?: string;
  payment_type?: string;
  signature_key?: string;
};

export function verifySignature(n: MidtransStatus) {
  const { serverKey } = payConfig();
  if (!serverKey || !n.signature_key || !n.order_id) return false;
  const expected = createHash("sha512")
    .update(`${n.order_id}${n.status_code ?? ""}${n.gross_amount ?? ""}${serverKey}`)
    .digest("hex");
  return expected === n.signature_key;
}

function mapStatus(n: MidtransStatus): "paid" | "pending" | "failed" | "refunded" {
  const ts = (n.transaction_status || "").toLowerCase();
  const fraud = (n.fraud_status || "accept").toLowerCase();
  if ((ts === "settlement" || ts === "capture") && fraud === "accept") return "paid";
  if (ts === "pending" || (ts === "capture" && fraud === "challenge")) return "pending";
  if (ts === "refund" || ts === "partial_refund" || ts === "chargeback" || ts === "partial_chargeback") return "refunded";
  return "failed";
}

/** Applies a Midtrans status (from the webhook or the status API) to our records. */
export async function applyStatus(n: MidtransStatus) {
  if (!n.order_id) return null;
  const pay = await one<{ order_id: string; roll_id: string; amount: number; status: string }>(
    `select order_id, roll_id, amount, status from payments where order_id = $1`,
    [n.order_id]
  );
  if (!pay) return null;
  let status = mapStatus(n);
  // never trust an amount that differs from what we charged
  if (status === "paid" && Math.round(Number(n.gross_amount)) !== Number(pay.amount)) status = "failed";
  if (pay.status === "paid" && status !== "refunded") return { ...pay, status: "paid" };

  await query(
    `update payments set status = $2, payment_type = coalesce($3, payment_type), paid_at = case when $2 = 'paid' then now() else paid_at end where order_id = $1`,
    [pay.order_id, status, n.payment_type ?? null]
  );
  if (status === "paid") await query(`update rolls set paid = true where id = $1`, [pay.roll_id]);
  if (status === "refunded") {
    const other = await one(`select 1 as x from payments where roll_id = $1 and status = 'paid' and order_id <> $2`, [pay.roll_id, pay.order_id]);
    if (!other) await query(`update rolls set paid = false where id = $1`, [pay.roll_id]);
  }
  return { ...pay, status };
}

/** Asks Midtrans directly — covers a missed or slow webhook. */
export async function refreshFromMidtrans(orderId: string) {
  const c = payConfig();
  const res = await fetch(`${c.apiUrl}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: { accept: "application/json", authorization: auth(c.serverKey) },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as MidtransStatus | null;
  if (!data || data.status_code === "404") return null;
  return applyStatus({ ...data, order_id: orderId });
}

export async function getPayment(orderId: string, rollId: string) {
  return one<{ order_id: string; status: string }>(
    `select order_id, status from payments where order_id = $1 and roll_id = $2`,
    [orderId, rollId]
  );
}

/** Re-checks recent pending payments so a reload unlocks downloads even without the webhook. */
export async function reconcilePending(roll: RollData) {
  if (!payConfig().enabled || roll.paid) return;
  const rows = await query<{ order_id: string }>(
    `select order_id from payments where roll_id = $1 and status = 'pending' and created_at > now() - interval '6 hours'
      order by created_at desc limit 3`,
    [roll.id]
  );
  await Promise.all(rows.map((r) => refreshFromMidtrans(r.order_id).catch(() => null)));
}
