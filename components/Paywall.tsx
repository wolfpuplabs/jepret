"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "./I18n";

export type PayCfg = { enabled: boolean; clientKey: string; snapJs: string };

type SnapResult = { order_id?: string; transaction_status?: string };
type SnapApi = {
  pay: (
    token: string,
    cb: {
      onSuccess?: (r: SnapResult) => void;
      onPending?: (r: SnapResult) => void;
      onError?: (r: SnapResult) => void;
      onClose?: () => void;
    }
  ) => void;
};
declare global {
  interface Window { snap?: SnapApi }
}

export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

let snapLoading: Promise<SnapApi> | null = null;
function loadSnap(src: string, clientKey: string) {
  if (window.snap) return Promise.resolve(window.snap);
  if (!snapLoading) {
    snapLoading = new Promise<SnapApi>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.setAttribute("data-client-key", clientKey);
      s.async = true;
      s.onload = () => (window.snap ? resolve(window.snap) : reject(new Error("snap")));
      s.onerror = () => { snapLoading = null; reject(new Error("snap")); };
      document.head.appendChild(s);
    });
  }
  return snapLoading;
}

type Phase = "choose" | "opening" | "waiting" | "done" | "error";

export function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/**
 * Bottom sheet that sells the download of a developed roll and runs Midtrans
 * Snap (QRIS / GoPay). `initialOrder` resumes polling after a GoPay redirect.
 */
export default function Paywall({
  slug, cfg, price, exposures, event, open, onClose, onUnlocked, initialOrder,
}: {
  slug: string;
  cfg: PayCfg;
  price: number;
  exposures: number;
  event: boolean;
  open: boolean;
  onClose: () => void;
  onUnlocked: () => void;
  initialOrder?: string | null;
}) {
  const { t } = useT();
  const p = t.pay;
  const [phase, setPhase] = useState<Phase>("choose");
  const [msg, setMsg] = useState<string | null>(null);
  const orderRef = useRef<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const stopPoll = () => {
    if (pollRef.current) window.clearTimeout(pollRef.current);
    pollRef.current = null;
  };

  const check = useCallback(async (orderId: string) => {
    const r = await fetch(`/api/r/${slug}/pay?order=${encodeURIComponent(orderId)}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    return j as { status?: string; unlocked?: boolean };
  }, [slug]);

  const poll = useCallback((orderId: string, tries = 0) => {
    stopPoll();
    orderRef.current = orderId;
    setPhase("waiting");
    const tick = async () => {
      const j = await check(orderId).catch(() => ({} as { status?: string; unlocked?: boolean }));
      if (j.unlocked || j.status === "paid") {
        setPhase("done");
        window.setTimeout(onUnlocked, 1100);
        return;
      }
      if (j.status === "failed") {
        setMsg(p.failed);
        setPhase("error");
        return;
      }
      if (tries < 90) pollRef.current = window.setTimeout(() => poll(orderId, tries + 1), 2500);
    };
    tick();
  }, [check, onUnlocked, p.failed]);

  useEffect(() => {
    if (initialOrder) poll(initialOrder);
    return stopPoll;
  }, [initialOrder, poll]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && phase !== "waiting" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, phase, onClose]);

  const pay = async () => {
    setMsg(null);
    setPhase("opening");
    try {
      const r = await fetch(`/api/r/${slug}/pay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const j = await r.json();
      if (j.unlocked) { setPhase("done"); window.setTimeout(onUnlocked, 700); return; }
      if (!r.ok || !j.token) throw new Error("pay");
      orderRef.current = j.orderId;
      let snap: SnapApi;
      try {
        snap = await loadSnap(cfg.snapJs, cfg.clientKey);
      } catch {
        // Snap script blocked: fall back to Midtrans' hosted payment page.
        if (j.redirectUrl) { window.location.href = j.redirectUrl; return; }
        throw new Error("snap");
      }
      snap.pay(j.token, {
        onSuccess: () => poll(j.orderId),
        onPending: () => poll(j.orderId),
        onError: () => { setMsg(p.failed); setPhase("error"); },
        onClose: () => poll(j.orderId),
      });
    } catch {
      setMsg(p.unavailable);
      setPhase("error");
    }
  };

  if (!open && phase !== "waiting" && phase !== "done") return null;

  const busy = phase === "opening";

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="paywall-title"
      onClick={(e) => e.target === e.currentTarget && phase !== "waiting" && onClose()}>
      <div className="sheet">
        <div className="sheet-grip" />
        {phase === "done" ? (
          <div className="pw-state">
            <div className="pw-check">✓</div>
            <h3 id="paywall-title">{p.success}</h3>
            <p className="muted">{p.successD}</p>
          </div>
        ) : phase === "waiting" ? (
          <div className="pw-state">
            <div className="pw-spinner" />
            <h3 id="paywall-title">{p.waiting}</h3>
            <p className="muted">{p.waitingD}</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn btn-ghost btn-small" onClick={() => orderRef.current && poll(orderRef.current)}>{p.check}</button>
              <button className="btn btn-ghost btn-small" onClick={() => { stopPoll(); setPhase("choose"); onClose(); }}>{t.common.close}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="pw-head">
              <span className="pw-lock"><LockIcon size={18} /></span>
              <div>
                <h3 id="paywall-title">{p.title}</h3>
                <p className="muted small" style={{ margin: "4px 0 0" }}>{p.lead.replace("{all}", event ? p.allEvent : "")}</p>
              </div>
            </div>
            <div className="pw-price">
              <b>{rupiah(price)}</b>
              <span>Roll {exposures} · {p.methods}</span>
            </div>
            <div className="pw-methods" aria-hidden="true">
              <span className="pw-chip">QRIS</span>
              <span className="pw-chip">GoPay</span>
            </div>
            {msg && <p className="err" style={{ margin: 0 }}>{msg}</p>}
            <button className="btn btn-accent btn-block" onClick={pay} disabled={busy}>
              {busy ? p.opening : `${p.btn} · ${rupiah(price)}`}
            </button>
            <p className="hint" style={{ textAlign: "center", margin: 0 }}>{p.secure}</p>
            <button className="btn btn-ghost btn-small" style={{ justifySelf: "center" }} onClick={onClose}>{t.common.cancel}</button>
          </>
        )}
      </div>
    </div>
  );
}
