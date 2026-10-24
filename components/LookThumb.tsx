/* eslint-disable @next/next/no-img-element */
import type { Look } from "@/lib/filters";

/** Instagram-style filter preview: the same sample photo with the look's live-preview filter. */
export default function LookThumb({ look, src = "/photos/sm/dip.jpg" }: { look: Look; src?: string }) {
  return (
    <div className="swatch look-thumb" aria-hidden="true">
      <img src={src} alt="" loading="lazy" style={{ filter: look.css === "none" ? undefined : look.css }} />
      {look.overlay && <i style={{ background: look.overlay }} />}
    </div>
  );
}
