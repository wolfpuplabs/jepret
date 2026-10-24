import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { hashToken, safeEqualHex } from "@/lib/ids";
import { assumptions, windowStats } from "@/lib/ops";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "ops" }, robots: { index: false, follow: false } };

const idr = (n: number) => "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n));
const pct = (n: number) => (n * 100).toFixed(1) + "%";
const COLOR = { GO: "#1f8a4c", HOLD: "#b7791f", "NO-GO": "#c53030" } as const;

/**
 * Private KPI + ROI page for the go / no-go decision. Open with
 * /ops?key=OPS_KEY. Without OPS_KEY set in the environment the page does not exist.
 */
export default async function Ops({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const secret = process.env.OPS_KEY;
  const { key } = await searchParams;
  if (!secret || !key || !safeEqualHex(hashToken(key), hashToken(secret))) notFound();

  const [w7, w30, w90] = await Promise.all([windowStats(7), windowStats(30), windowStats(90)]);
  const a = assumptions();
  const rows: [string, (s: typeof w30) => string][] = [
    ["Created", (s) => String(s.created)],
    ["Joined (guests)", (s) => String(s.joined)],
    ["Photos uploaded", (s) => `${s.photos} · ${s.gb.toFixed(2)} GB`],
    ["Paywall hits", (s) => String(s.paywall)],
    ["Payments (refunds)", (s) => `${s.paid} (${s.refunded})`],
    ["Downloads", (s) => String(s.downloads)],
    ["Conversion paid ÷ created", (s) => pct(s.conversion)],
    ["Gross revenue", (s) => idr(s.gross)],
    ["Payment fees (est.)", (s) => idr(s.fees)],
    ["Storage + transfer (est.)", (s) => idr(s.infra)],
    ["Fixed costs (pro-rata)", (s) => idr(s.fixed)],
    ["Net", (s) => idr(s.net)],
    ["ROI net ÷ cost", (s) => pct(s.roi)],
  ];

  return (
    <main className="wrap" style={{ padding: "32px 16px 64px", maxWidth: 880 }}>
      <h1 style={{ fontSize: 32, margin: "0 0 4px" }}>ops · go / no-go</h1>
      <p className="muted small" style={{ margin: "0 0 24px" }}>
        Decision uses the 30-day window. Estimates use the assumptions listed below; change them with OPS_* env vars.
      </p>
      <div className="card pad" style={{ borderLeft: `6px solid ${COLOR[w30.decision]}`, marginBottom: 24 }}>
        <b style={{ fontSize: 24, color: COLOR[w30.decision] }}>{w30.decision}</b>
        <p style={{ margin: "6px 0 0" }}>{w30.why}</p>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8 }}>Metric</th>
              <th style={{ textAlign: "right", padding: 8 }}>7 days</th>
              <th style={{ textAlign: "right", padding: 8 }}>30 days</th>
              <th style={{ textAlign: "right", padding: 8 }}>90 days</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, f]) => (
              <tr key={label} style={{ borderTop: "1px solid rgba(127,127,127,.25)" }}>
                <td style={{ padding: 8 }}>{label}</td>
                <td style={{ padding: 8, textAlign: "right" }}>{f(w7)}</td>
                <td style={{ padding: 8, textAlign: "right" }}>{f(w30)}</td>
                <td style={{ padding: 8, textAlign: "right" }}>{f(w90)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 style={{ fontSize: 18, marginTop: 32 }}>Assumptions</h2>
      <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{JSON.stringify(a, null, 2)}</pre>
    </main>
  );
}
