"use client";
import { useEffect, useState } from "react";
import { useT } from "./I18n";
import { QRImage } from "./QR";

/** Bottom sheet with the event QR, a copy button and the native share sheet. */
export default function ShareSheet({ path, title, open, onClose }: { path: string; title: string; open: boolean; onClose: () => void }) {
  const { t } = useT();
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setUrl(`${window.location.origin}${path}`), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the link is still visible to copy by hand */
    }
  };
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet share-sheet">
        <div className="sheet-grip" />
        <div style={{ textAlign: "center" }}>
          <h3 id="share-title" style={{ margin: 0 }}>{t.guest.shareTitle}</h3>
          <p className="muted small" style={{ margin: "6px 0 0" }}>{t.guest.shareLead}</p>
        </div>
        <div className="share-qr">{url && <QRImage value={url} alt={title} />}</div>
        <div className="share-link mono">{url.replace(/^https?:\/\//, "")}</div>
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn btn-light btn-small" onClick={copy}>{copied ? t.common.copied : t.guest.copyLink}</button>
          {canShare && (
            <button className="btn btn-ghost btn-small" onClick={() => navigator.share({ title, url }).catch(() => {})}>{t.guest.share}</button>
          )}
        </div>
        <button className="btn btn-ghost btn-small" style={{ justifySelf: "center" }} onClick={onClose}>{t.common.close}</button>
      </div>
    </div>
  );
}
