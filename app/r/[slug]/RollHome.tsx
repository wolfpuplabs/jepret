"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/components/I18n";
import { CopyField, Countdown, LangToggle, Logo, useShortCountdown } from "@/components/ui";
import ShareSheet from "@/components/ShareSheet";
import { CameraIcon, DownloadIcon, QrIcon } from "@/components/UiIcons";
import { QRImage } from "@/components/QR";
import { rupiah } from "@/lib/packages";

type Props = {
  roll: {
    slug: string; name: string; mode: "personal" | "event"; exposures: number; price: number;
    ownerName: string | null; endsAt: string | null; paid: boolean; iso: number;
  };
  phase: "shooting" | "developing" | "developed";
  developAt: string | null;
  used: number;
  people: number;
  member: { name: string } | null;
  owner: boolean;
  ownerUrl: string | null;
  guestUrl: string;
  isNew: boolean;
  preview: { id: string; thumbUrl: string; guestName: string | null }[];
};

export default function RollHome({ roll, phase, developAt, used, people, member, owner, ownerUrl, guestUrl, isNew, preview }: Props) {
  const { t, lang } = useT();
  const r = t.roll;
  const router = useRouter();
  const [joinOpen, setJoinOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toEnd = useShortCountdown(roll.endsAt ?? new Date().toISOString());
  const left = Math.max(0, roll.exposures - used);
  const albumHref = `/r/${roll.slug}/album`;
  const cover = roll.mode === "event" ? "/photos/confetti.jpg" : "/photos/hands-up.jpg";
  const fmt = (n: number) => new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-US").format(n);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/r/${roll.slug}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error === "full" ? r.full : j.error === "ended" ? r.ended : t.common.error);
      setBusy(false);
      return;
    }
    router.push(`/r/${roll.slug}/kamera`);
  };

  const ownerAction = async (action: "finish" | "delete") => {
    if (!confirm(action === "finish" ? r.sendToLabConfirm : r.deleteConfirm)) return;
    const res = await fetch(`/api/r/${roll.slug}/owner`, {
      method: action === "finish" ? "PATCH" : "DELETE",
      headers: { "content-type": "application/json" },
      body: action === "finish" ? JSON.stringify({ action: "finish" }) : undefined,
    });
    if (!res.ok) return alert(t.common.error);
    if (action === "delete") router.push("/");
    else router.refresh();
  };

  const statusValue =
    phase === "shooting"
      ? roll.mode === "event" && roll.endsAt ? toEnd : r.shooting
      : phase === "developing" ? r.developing : r.developed;
  const statusLabel = phase === "shooting" && roll.mode === "event" ? r.timeLeft : r.status;

  let primary: React.ReactNode;
  if (phase === "shooting" && member) {
    primary = (
      <Link href={`/r/${roll.slug}/kamera`} className="eh-primary">
        <CameraIcon /> <span>{r.openCamera}</span> <small>{left} {t.guest.shotsLeftShort}</small>
      </Link>
    );
  } else if (phase === "shooting" && roll.mode === "event") {
    primary = (
      <button type="button" className="eh-primary" onClick={() => setJoinOpen(true)} disabled={left === 0}>
        <CameraIcon /> <span>{left === 0 ? r.full : r.join}</span>
      </button>
    );
  } else if (phase === "developed") {
    primary = (
      <Link href={albumHref} className="eh-primary">
        <span>{r.album}</span> <small>{fmt(used)} {t.common.photos}</small>
      </Link>
    );
  } else {
    primary = <span className="eh-primary is-off" aria-disabled="true"><span>{r.developing}</span></span>;
  }

  return (
    <div className="eh">
      <header className="eh-hero">
        <img src={cover} alt="" className="eh-cover" />
        <div className="eh-shade" />
        <div className="eh-top">
          <Link href="/" className="logo-link" aria-label="jepret"><Logo light /></Link>
          <LangToggle dark />
        </div>
        <div className="eh-head">
          <span className="eh-host">
            {roll.mode === "event" ? r.eventBadge : r.personalBadge} · {roll.exposures} EXP · ISO {roll.iso}
          </span>
          <h1>{roll.name}</h1>
          <div className="eh-stats">
            <div><b>{fmt(used)}<small>/{roll.exposures}</small></b><span>{r.shotsTaken}</span></div>
            <div><b suppressHydrationWarning>{statusValue}</b><span>{statusLabel}</span></div>
            {roll.mode === "event" ? (
              <div><b>{fmt(people)}</b><span>{r.people}</span></div>
            ) : (
              <div><b>{rupiah(roll.price).replace(/\s/g, "")}</b><span>{r.price}</span></div>
            )}
          </div>
        </div>
      </header>

      <div className="eh-body">
        {isNew && (
          <div className="jp-new">
            <b>🎞️ {r.newTitle}</b>
            <span>{roll.mode === "event" ? r.newLeadEvent : r.newLeadPersonal}</span>
          </div>
        )}

        <div className="eh-actions" style={roll.mode === "personal" ? { gridTemplateColumns: "1fr 54px" } : undefined}>
          {primary}
          {roll.mode === "event" && (
            <button type="button" className="eh-sq" onClick={() => setShareOpen(true)} aria-label={t.guest.shareTitle}>
              <QrIcon />
            </button>
          )}
          <Link href={albumHref} className="eh-sq" aria-label={r.album}><DownloadIcon /></Link>
        </div>

        {member && !owner && <p className="eh-hello">👋 {r.hello}, {member.name}</p>}

        {phase === "developed" && preview.length > 0 ? (
          <>
            <div className="eh-grid">
              {preview.map((p) => (
                <Link key={p.id} href={albumHref} className="eh-tile">
                  <img src={p.thumbUrl} alt="" loading="lazy" />
                  {roll.mode === "event" && p.guestName && <span>{p.guestName}</span>}
                </Link>
              ))}
            </div>
            {used > preview.length && (
              <Link href={albumHref} className="btn btn-ghost btn-block" style={{ marginTop: 14 }}>
                {r.album} · {fmt(used)}
              </Link>
            )}
          </>
        ) : phase === "developing" && developAt ? (
          <div className="jp-lab">
            <div className="jp-lab-light" aria-hidden="true" />
            <p className="muted" style={{ margin: 0 }}>{r.developingLead}</p>
            <Countdown iso={developAt} onDone={() => router.refresh()} />
            <div className="eh-grid">
              {Array.from({ length: Math.max(2, Math.min(used, 6)) }, (_, i) => (
                <div key={i} className="eh-tile eh-dev jp-dev" style={{ animationDelay: `${i * 0.3}s` }} />
              ))}
            </div>
          </div>
        ) : phase === "shooting" ? (
          <>
            <p className="eh-note">{r.developingGrid}</p>
            <div className="jp-counter-strip" aria-hidden="true">
              {Array.from({ length: Math.min(roll.exposures, 36) }, (_, i) => (
                <i key={i} className={i < Math.round((used / roll.exposures) * Math.min(roll.exposures, 36)) ? "on" : ""} />
              ))}
            </div>
          </>
        ) : (
          <p className="eh-note">{t.guest.empty}</p>
        )}

        {owner && (
          <section className="card pad jp-owner">
            <h3>{r.ownerTitle}</h3>
            {ownerUrl && (
              <>
                <CopyField label={r.ownerLink} value={ownerUrl} secret />
                <p className="hint" style={{ margin: "-6px 0 0" }}>{r.ownerLinkD}</p>
              </>
            )}
            {roll.mode === "event" && (
              <div className="jp-guest-link">
                <CopyField label={r.guestLink} value={guestUrl} />
                <div className="jp-qr"><QRImage value={guestUrl} alt={roll.name} /></div>
              </div>
            )}
            <div className="row" style={{ flexWrap: "wrap" }}>
              {phase === "shooting" && used > 0 && (
                <button className="btn btn-small" onClick={() => ownerAction("finish")}>{r.sendToLab}</button>
              )}
              <button className="btn btn-small btn-danger" onClick={() => ownerAction("delete")}>{r.deleteRoll}</button>
            </div>
          </section>
        )}
      </div>

      {joinOpen && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="join-title" onClick={(e) => e.target === e.currentTarget && !busy && setJoinOpen(false)}>
          <form className="sheet" onSubmit={join}>
            <div className="sheet-grip" />
            <div>
              <h3 id="join-title" style={{ margin: 0 }}>{r.joinTitle}</h3>
              <p className="muted small" style={{ margin: "6px 0 0" }}>{r.joinLead}</p>
            </div>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={r.namePh} maxLength={40} autoComplete="given-name" autoFocus required />
            {error && <span className="err">{error}</span>}
            <button className="btn btn-accent btn-block" disabled={busy || !name.trim()}>
              {busy ? r.joining : `${r.join} →`}
            </button>
          </form>
        </div>
      )}
      <ShareSheet path={`/r/${roll.slug}`} title={roll.name} open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
