import Link from "next/link";
import { getT } from "@/lib/i18n-server";
import { packages } from "@/lib/packages";
import FilmBox from "@/components/FilmBox";
import { Print, Scene } from "@/components/Illustrations";

const STEP_PHOTOS = ["cheers", "dip", "confetti", "cake-cut"] as const;

export default async function Home() {
  const { t, lang } = await getT();
  const packs = packages();
  const personal = packs.filter((p) => p.mode === "personal");
  const event = packs.filter((p) => p.mode === "event");
  const words = t.home.title.split(" ");
  return (
    <>
      <section className="hero jp-hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">{t.home.eyebrow}</span>
            <h1>
              {words.slice(0, -2).join(" ")} <em>{words.slice(-2).join(" ")}</em>
            </h1>
            <p className="lead">{t.home.lead}</p>
            <div className="actions">
              <Link href="/beli" className="btn btn-accent">{t.home.ctaPrimary} →</Link>
              <Link href="#cara" className="btn btn-ghost">{t.home.ctaSecondary}</Link>
            </div>
            <ul className="pills">
              {t.home.pills.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>

          <div className="jp-art" aria-hidden="true">
            <Print kind="hands-up" caption="21.14" className="jp-print jp-p1" eager />
            <Print kind="kiss" caption="19.48" className="jp-print jp-p2" eager />
            <div className="jp-cam">
              <div className="jp-cam-top"><i className="jp-wheel" /><i className="jp-btn" /></div>
              <div className="jp-cam-body">
                <div className="jp-flash" />
                <div className="jp-vf" />
                <div className="jp-lens"><i /></div>
                <div className="jp-label">
                  <b>jepret</b>
                  <span>ISO 400 · 25 EXP</span>
                </div>
                <div className="jp-counter"><span>17</span></div>
              </div>
            </div>
            <div className="jp-strip">
              {(["dip", "cheers", "confetti"] as const).map((k) => (
                <div key={k} className="jp-frame"><Scene kind={k} lite /></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="roll">
        <div className="wrap">
          <div className="roll-group">
            <div className="section-head">
              <h2>{t.home.personalTitle}</h2>
              <p className="muted">{t.home.personalLead}</p>
            </div>
            <div className="filmboxes">
              {personal.map((p) => (
                <Link key={p.id} href={`/beli?pack=${p.id}`} className="fb-link">
                  <FilmBox pack={p} lang={lang} exp={t.home.exp} perShot={t.home.perShot} />
                </Link>
              ))}
            </div>
          </div>
          <div className="roll-group">
            <div className="section-head">
              <h2>{t.home.eventTitle}</h2>
              <p className="muted">{t.home.eventLead}</p>
            </div>
            <div className="filmboxes">
              {event.map((p) => (
                <Link key={p.id} href={`/beli?pack=${p.id}`} className="fb-link">
                  <FilmBox pack={p} lang={lang} exp={t.home.exp} perShot={t.home.perShot} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="cara">
        <div className="wrap">
          <div className="section-head"><h2>{t.home.howTitle}</h2></div>
          <ol className="jp-steps">
            {t.home.steps.map((s, i) => (
              <li key={s.t} className="card">
                <div className="jp-step-img"><Scene kind={STEP_PHOTOS[i]} lite className={i === 2 ? "is-dev" : ""} /></div>
                <span className="jp-step-n">{String(i + 1).padStart(2, "0")}</span>
                <h3>{s.t}</h3>
                <p className="muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="wrap narrow">
          <div className="section-head"><h2>{t.home.faqTitle}</h2></div>
          <div className="faq">
            {t.home.faq.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 40 }}>
        <div className="wrap">
          <div className="cta-band">
            <h2>{t.home.ctaTitle}</h2>
            <p>{t.home.ctaLead}</p>
            <Link href="/beli" className="btn btn-accent">{t.home.ctaPrimary} →</Link>
          </div>
        </div>
      </section>
    </>
  );
}
