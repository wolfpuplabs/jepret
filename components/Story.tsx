"use client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "./I18n";
import { Print, Scene } from "./Illustrations";
import { CameraIcon } from "./UiIcons";

/* decorative QR-like pattern (illustration only, not scannable) */
const PseudoQR = memo(function PseudoQR({ size = 25 }: { size?: number }) {
  const cells = useMemo(() => {
    let s = 7331;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const out: [number, number][] = [];
    const finder = (x: number, y: number) => x < 7 && y < 7;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const inFinder = finder(x, y) || finder(size - 1 - x, y) || finder(x, size - 1 - y);
        if (!inFinder && rnd() > 0.52) out.push([x, y]);
      }
    return out;
  }, [size]);
  const Finder = ({ x, y }: { x: number; y: number }) => (
    <g transform={`translate(${x} ${y})`}>
      <rect width="7" height="7" rx="1.6" fill="#1a1203" />
      <rect x="1" y="1" width="5" height="5" rx="1.1" fill="#fff" />
      <rect x="2" y="2" width="3" height="3" rx=".7" fill="#1a1203" />
    </g>
  );
  return (
    <svg viewBox={`-1 -1 ${size + 2} ${size + 2}`} className="pqr" aria-hidden="true">
      <rect x="-1" y="-1" width={size + 2} height={size + 2} rx="2" fill="#fff" />
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x + 0.08} y={y + 0.08} width=".84" height=".84" rx=".25" fill="#1a1203" />)}
      <Finder x={0} y={0} />
      <Finder x={size - 7} y={0} />
      <Finder x={0} y={size - 7} />
    </svg>
  );
});

const ALBUM = ["dip", "cheers", "hands-up", "confetti", "kiss", "glasses"] as const;
const BOXES = [
  { n: 10, c: "#ffc53d", p: "Rp 9.000" },
  { n: 25, c: "#ff8a3d", p: "Rp 19.000" },
  { n: 36, c: "#ff5a36", p: "Rp 25.000" },
];
const N = 5;
const DEV_SECONDS = 59 * 60 + 12;

const hms = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, "0"));
};

/**
 * Scroll-locked story of a roll. The section is tall; an inner frame sticks to
 * the viewport while scroll progress picks the chapter and drives small
 * animations (roll counter, lab countdown, payment).
 */
export default function Story() {
  const { t } = useT();
  const s = t.story;
  const sectionRef = useRef<HTMLElement>(null);
  const countRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [shots, setShots] = useState(25);
  const [joined, setJoined] = useState(0);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const dist = rect.height - window.innerHeight;
      const p = dist > 0 ? Math.min(1, Math.max(0, -rect.top / dist)) : 0;
      const pn = p * N;
      const idx = Math.min(N - 1, Math.floor(pn));
      el.style.setProperty("--p5", pn.toFixed(3));
      setActive(idx);
      const shootLocal = Math.min(1, Math.max(0, pn - 2));
      setShots(25 - Math.min(8, Math.floor(shootLocal * 9)));
      const loadLocal = Math.min(1, Math.max(0, pn - 1));
      setJoined(idx === 1 || idx === 2 ? Math.min(3, Math.floor((idx === 1 ? loadLocal : 1) * 4.2)) : 0);
      const devLocal = Math.min(1, Math.max(0, pn - 3));
      if (countRef.current) {
        const [h, m, sec] = hms(DEV_SECONDS * (1 - devLocal));
        countRef.current.innerHTML = `<b>${h}</b>:<b>${m}</b>:<b>${sec}</b>`;
      }
      setPaid(pn - 4 > 0.45);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const jump = useCallback((i: number) => {
    const el = sectionRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const dist = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + ((i + 0.35) / N) * dist, behavior: "smooth" });
  }, []);

  const on = (i: number) => (active === i ? "on" : "");
  const [h0, m0, s0] = hms(DEV_SECONDS);

  return (
    <>
      <div className="wrap story-head" id="cara">
        <span className="eyebrow">{s.eyebrow}</span>
        <h2 id="story-title">{s.title}</h2>
      </div>

      <section className="story" ref={sectionRef} aria-labelledby="story-title" style={{ ["--n" as string]: N }}>
        <div className="story-sticky">
          <div className="wrap story-frame">
            <div className="story-copy">
              <div className="caps" aria-live="polite">
                {s.chapters.map((c, i) => (
                  <article key={c.k} className={`cap ${i === active ? "on" : i < active ? "past" : "next"}`} aria-hidden={i !== active}>
                    <span className="cap-k">{c.k} <i>/ 0{N}</i></span>
                    <h3>{c.t}</h3>
                    <p>{c.d}</p>
                  </article>
                ))}
              </div>
              <div className="story-progress" role="tablist" aria-label={s.eyebrow}>
                {s.chapters.map((c, i) => (
                  <button key={c.k} role="tab" aria-selected={i === active} aria-label={c.t} className={i === active ? "on" : ""} style={{ ["--i" as string]: i }} onClick={() => jump(i)}>
                    <span />
                  </button>
                ))}
              </div>
            </div>

            <div className="stage" aria-hidden="true">
              <div className="stage-inner">
                <Print kind="dip" caption="21.14" className={`fly fly-1 ${on(4)}`} />
                <Print kind="cheers" caption="20.02" className={`fly fly-2 ${on(4)}`} />
                <Print kind="hands-up" caption="22.37" className={`fly fly-3 ${on(4)}`} />
                <Print kind="kiss" caption="19.48" className={`fly fly-4 ${on(4)}`} />

                <div className={`table-card ${on(1)}`}>
                  <PseudoQR />
                  <b>jepret · Party 100</b>
                  <span>{s.stage.scan}</span>
                </div>

                <div className={`join-chips ${active === 1 || active === 2 ? "on" : ""}`}>
                  {["Ayu", "Bima", "Citra"].map((n, i) => (
                    <span key={n} className={`join-chip ${(active === 1 || active === 2) && joined > i ? "in" : ""}`}>
                      <i>{n[0]}</i>{n}<span className="jc-joined">&nbsp;{s.stage.joined}</span>
                    </span>
                  ))}
                </div>

                <div className="phone stage-phone">
                  <div className="phone-screen">
                    <div className="phone-notch" />

                    <div className={`screen sj-pick ${on(0)}`}>
                      <div className="sj-title">jepret</div>
                      <div className="sj-boxes">
                        {BOXES.map((b, i) => (
                          <div key={b.n} className={`sj-box ${i === 1 ? "sel" : ""}`} style={{ ["--fb" as string]: b.c }}>
                            <i />
                            <b>{b.n}<small>EXP</small></b>
                            <span>{b.p}</span>
                          </div>
                        ))}
                      </div>
                      <div className="sj-btn">{s.stage.getRoll} · 25</div>
                    </div>

                    <div className={`screen sj-hub ${on(1)}`}>
                      <div className="sj-cover"><Scene kind="hands-up" lite /></div>
                      <div className="sj-hub-body">
                        <b className="sj-hub-title">{s.demo}</b>
                        <span className="sj-hub-meta">25 EXP · ISO 400</span>
                        <div className="sj-open"><CameraIcon size={14} /> {s.stage.openCamera} <small>25 {s.stage.left}</small></div>
                        <div className="sj-strip">{Array.from({ length: 25 }, (_, i) => <i key={i} />)}</div>
                      </div>
                    </div>

                    <div className={`screen screen-shoot ${on(2)}`}>
                      <Scene kind="night-dance" />
                      <div className="vf-top"><span>{s.demo}</span><span className="vf-count">{shots}/25</span></div>
                      <div className="vf-brackets"><i /><i /><i /><i /></div>
                      <div className="vf-stamp">&apos;26 10 25</div>
                      {active === 2 && shots < 25 && <div key={shots} className="vf-flash" />}
                      <div className="vf-bar"><i /><b /><i /></div>
                    </div>

                    <div className={`screen sj-lab ${on(3)}`}>
                      <div className="sj-safelight" />
                      <div className="dev-roll" />
                      <span className="dev-label">{s.stage.lab}</span>
                      <div className="dev-count" ref={countRef}><b>{h0}</b>:<b>{m0}</b>:<b>{s0}</b></div>
                      <div className="dev-tiles">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</div>
                    </div>

                    <div className={`screen screen-album developed ${on(4)}`}>
                      <div className="al-head"><b>{s.stage.developed}</b><span>17 {s.stage.photos}</span></div>
                      <div className="al-grid">
                        {ALBUM.map((k, i) => <Scene key={i} kind={k} lite style={{ transitionDelay: `${i * 70}ms` }} />)}
                      </div>
                      <div className={`sj-pay ${paid ? "paid" : ""}`}>{paid ? `✓ ${s.stage.paid}` : `🔒 ${s.stage.pay}`}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
