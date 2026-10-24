"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/I18n";
import FilmBox from "@/components/FilmBox";
import LookThumb from "@/components/LookThumb";
import { LOOKS } from "@/lib/filters";
import { rupiah, type DevelopMode, type Mode, type Pack } from "@/lib/packages";

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function BuyRoll({ packs, initialPack }: { packs: Pack[]; initialPack: string | null }) {
  const { t, lang } = useT();
  const b = t.buy;
  const router = useRouter();
  const start = packs.find((p) => p.id === initialPack) ?? packs.find((p) => p.id === "classic")!;
  const [mode, setMode] = useState<Mode>(start.mode);
  const [packId, setPackId] = useState(start.id);
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [endsAt, setEndsAt] = useState(() => toLocalInput(new Date(Date.now() + 6 * 3600_000)));
  const [develop, setDevelop] = useState<DevelopMode>("hour");
  const [look, setLook] = useState("film35");
  const [guestLooks, setGuestLooks] = useState(true);
  const [stamp, setStamp] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => packs.filter((p) => p.mode === mode), [packs, mode]);
  const pack = packs.find((p) => p.id === packId && p.mode === mode) ?? list[Math.min(1, list.length - 1)];

  const switchMode = (m: Mode) => {
    setMode(m);
    const l = packs.filter((p) => p.mode === m);
    setPackId(l[Math.min(1, l.length - 1)].id);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError(b.errName);
    if (mode === "event" && new Date(endsAt).getTime() < Date.now() + 5 * 60_000) return setError(b.errEnd);
    setBusy(true);
    const r = await fetch("/api/rolls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pack: pack.id, name, ownerName, developMode: develop, look, guestLooks, dateStamp: stamp,
        endsAt: mode === "event" ? new Date(endsAt).toISOString() : null,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.slug) {
      setError(j.error === "name" ? b.errName : j.error === "ends" ? b.errEnd : t.common.error);
      setBusy(false);
      return;
    }
    router.push(`/r/${j.slug}?baru=1`);
  };

  const devs: { id: DevelopMode; l: string; d: string }[] = [
    { id: "instant", l: b.devInstant, d: b.devInstantD },
    { id: "hour", l: b.devHour, d: b.devHourD },
    { id: "morning", l: b.devMorning, d: b.devMorningD },
  ];

  return (
    <section className="section" style={{ paddingTop: 40 }}>
      <div className="wrap narrow">
        <h1 style={{ fontSize: "clamp(36px,6vw,56px)", marginBottom: 28 }}>{b.title}</h1>
        <form onSubmit={submit} className="card pad buy">
          <div className="field">
            <span className="label">{b.mode}</span>
            <div className="seg2">
              {(["personal", "event"] as Mode[]).map((m) => (
                <button key={m} type="button" className={`seg2-opt ${mode === m ? "on" : ""}`} onClick={() => switchMode(m)}>
                  <b>{m === "personal" ? b.personal : b.event}</b>
                  <span>{m === "personal" ? b.personalD : b.eventD}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="label">{b.pack}</span>
            <div className="filmboxes">
              {list.map((p) => (
                <button key={p.id} type="button" className="fb-pick" onClick={() => setPackId(p.id)} aria-pressed={pack.id === p.id}>
                  <FilmBox pack={p} lang={lang} exp={t.home.exp} selected={pack.id === p.id} compact />
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span className="label">{b.name}</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
              placeholder={mode === "event" ? b.namePhEvent : b.namePhPersonal} required />
          </label>
          <label className="field">
            <span className="label">{b.yourName}</span>
            <input type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} maxLength={40} placeholder={b.yourNamePh} autoComplete="given-name" />
          </label>
          {mode === "event" && (
            <label className="field">
              <span className="label">{b.endsAt}</span>
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
              <span className="hint">{b.endsAtD}</span>
            </label>
          )}

          <div className="field">
            <span className="label">{b.develop}</span>
            <div className="choice-grid">
              {devs.map((d) => (
                <button key={d.id} type="button" className={`choice ${develop === d.id ? "on" : ""}`} onClick={() => setDevelop(d.id)}>
                  <b>{d.l}</b>
                  <span>{d.d}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="label">{b.look}</span>
            <div className="choice-grid look-grid">
              {LOOKS.map((l) => (
                <button type="button" key={l.id} className={`choice ${look === l.id ? "on" : ""}`} onClick={() => setLook(l.id)}>
                  <LookThumb look={l} />
                  <b>{l.name[lang]}</b>
                  <span>{l.note[lang]}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="toggle field">
            <span className="t-text"><b>{b.guestLooks}</b><span>{b.guestLooksD}</span></span>
            <input type="checkbox" checked={guestLooks} onChange={(e) => setGuestLooks(e.target.checked)} />
          </label>
          <label className="toggle field">
            <span className="t-text"><b>{b.stamp}</b><span>{b.stampD}</span></span>
            <input type="checkbox" checked={stamp} onChange={(e) => setStamp(e.target.checked)} />
          </label>

          <div className="buy-pay">
            <div>
              <b>{b.pay}</b>
              <span>{b.payD}</span>
            </div>
            <strong>{rupiah(pack.price)}</strong>
          </div>

          {error && <p className="err">{error}</p>}
          <button className="btn btn-accent btn-block" disabled={busy}>
            {busy ? b.creating : `${b.submit} · ${b.summary.replace("{n}", String(pack.exposures)).replace("{p}", rupiah(pack.price))}`}
          </button>
        </form>
      </div>
    </section>
  );
}
