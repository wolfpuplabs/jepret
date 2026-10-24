import "server-only";
import { query } from "./db";

/**
 * ROI view over the metrics log (lib/guard.ts). Every assumption is an env
 * var so the numbers can be re-run as real costs come in; the defaults are
 * the ones used in the PRD / JEV decision document.
 */

const num = (name: string, dflt: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && process.env[name] !== "" && process.env[name] != null ? v : dflt;
};

export function assumptions() {
  return {
    usdIdr: num("OPS_USD_IDR", 16500),
    // Midtrans QRIS MDR is 0.7%; GoPay and others are higher, so the blended default is conservative
    mdrPct: num("OPS_MDR_PCT", 1.5),
    vatOnFeePct: 11,
    // Vercel Pro platform fee ($20) + domain + buffer, per month, in rupiah
    fixedIdrMonth: num("OPS_FIXED_IDR_MONTH", 400_000),
    storageUsdGbMonth: num("OPS_STORAGE_USD_GB", 0.023),
    // the docs example (iad1) is $0.05/GB; Asia regions cost more, so default is doubled
    transferUsdGb: num("OPS_TRANSFER_USD_GB", 0.1),
    // each uploaded byte is viewed this many times (thumbs, album, lightbox)
    viewFactor: num("OPS_VIEW_FACTOR", 3),
    retentionDays: num("OPS_RETENTION_DAYS", PRODUCT.retentionDays),
    // JEV gate thresholds
    goConversion: num("OPS_GO_CONV", PRODUCT.goConversion),
    killConversion: num("OPS_KILL_CONV", PRODUCT.killConversion),
    minSample: num("OPS_MIN_SAMPLE", 50),
  };
}

type Row = { name: string; n: number; amount: number; bytes: number };

export async function windowStats(days: number) {
  const rows = await query<Row>(
    `select name, count(*)::int as n, coalesce(sum(amount), 0)::bigint as amount, coalesce(sum(bytes), 0)::bigint as bytes
       from metrics where at > now() - ($1 || ' days')::interval group by name`,
    [String(days)]
  );
  const by = (k: string) => rows.find((r) => r.name === k) ?? { name: k, n: 0, amount: 0, bytes: 0 };
  const created = by("created");
  const paid = by("paid");
  const refunded = by("refunded");
  const photo = by("photo");
  const a = assumptions();

  const gross = Number(paid.amount) - Number(refunded.amount);
  const fees = (gross * a.mdrPct) / 100 * (1 + a.vatOnFeePct / 100);
  const gb = Number(photo.bytes) / 1e9;
  const avgPhoto = photo.n ? Number(photo.bytes) / photo.n : 0;
  const storageGbMonth = gb * (a.retentionDays / 30);
  const transferGb = gb * a.viewFactor + (by("download").n * avgPhoto) / 1e9;
  const infra = (storageGbMonth * a.storageUsdGbMonth + transferGb * a.transferUsdGb) * a.usdIdr;
  const fixed = a.fixedIdrMonth * (days / 30);
  const cost = fees + infra + fixed;
  const net = gross - cost;
  const conversion = created.n ? paid.n / created.n : 0;
  const roi = cost > 0 ? net / cost : 0;

  let decision: "GO" | "HOLD" | "NO-GO";
  let why: string;
  if (created.n < a.minSample) {
    decision = "HOLD";
    why = `sample too small (${created.n} < ${a.minSample} ${PRODUCT.unit})`;
  } else if (conversion < a.killConversion) {
    decision = "NO-GO";
    why = `conversion ${(conversion * 100).toFixed(1)}% is below the kill line of ${(a.killConversion * 100).toFixed(0)}%`;
  } else if (conversion >= a.goConversion && roi >= 0) {
    decision = "GO";
    why = `conversion ${(conversion * 100).toFixed(1)}% ≥ ${(a.goConversion * 100).toFixed(0)}% and revenue covers all costs`;
  } else {
    decision = "HOLD";
    why = roi < 0 ? "not covering costs yet — keep the spend frozen" : "conversion between kill and go lines";
  }

  return {
    days,
    created: created.n,
    createdValue: Number(created.amount),
    joined: by("joined").n,
    photos: photo.n,
    gb,
    paywall: by("paywall").n,
    paid: paid.n,
    refunded: refunded.n,
    downloads: by("download").n,
    gross,
    fees,
    infra,
    fixed,
    cost,
    net,
    conversion,
    roi,
    decision,
    why,
  };
}

/** jepret: unpaid rolls are cleared after 7 days, paid after 30 — blended default 12. */
const PRODUCT = { name: "jepret", unit: "rolls", retentionDays: 12, goConversion: 0.25, killConversion: 0.1 };
