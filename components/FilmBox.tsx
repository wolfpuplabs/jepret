import type { Pack } from "@/lib/packages";
import { rupiah } from "@/lib/packages";
import type { Lang } from "@/lib/i18n";

/** A roll package drawn like a little film carton. */
export default function FilmBox({ pack, lang, perShot, exp, selected, compact }: {
  pack: Pack; lang: Lang; perShot?: string; exp: string; selected?: boolean; compact?: boolean;
}) {
  return (
    <div className={`filmbox ${selected ? "on" : ""} ${compact ? "compact" : ""}`} style={{ ["--fb" as string]: pack.color }}>
      <div className="fb-top">
        <span className="fb-brand">jepret</span>
        <span className="fb-iso">ISO {pack.iso}</span>
      </div>
      <div className="fb-num">
        <b>{pack.exposures}</b>
        <small>{exp}</small>
      </div>
      <div className="fb-body">
        <span className="fb-name">{pack.name[lang]}</span>
        {!compact && <span className="fb-note">{pack.note[lang]}</span>}
        <span className="fb-price">{rupiah(pack.price)}</span>
        {perShot && <span className="fb-per">{perShot.replace("{p}", rupiah(Math.round(pack.price / pack.exposures)))}</span>}
      </div>
    </div>
  );
}
