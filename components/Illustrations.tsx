/**
 * jepret imagery — real event photos (Unsplash License, see
 * public/photos/CREDITS.md) shown as full-bleed scenes or developed prints.
 */
/* eslint-disable @next/next/no-img-element */
import { memo, type CSSProperties } from "react";

export const PHOTO_KINDS = [
  "dip", "kiss", "groove", "cheers", "hands-up", "night-dance", "toast-arch", "dance-floor", "reception",
  "confetti", "shoulders", "cake", "cake-cut", "glasses", "birthday", "champagne", "sunset", "petals",
] as const;
export type SceneKind = (typeof PHOTO_KINDS)[number];

export const photoSrc = (kind: SceneKind, small = false) => `/photos/${small ? "sm/" : ""}${kind}.jpg`;

/** A full-bleed photo. `lite` loads the small version (prints, thumbnails). */
function SceneImpl({ kind, className, style, lite = false, eager = false }: { kind: SceneKind; id?: string; className?: string; style?: CSSProperties; slice?: boolean; lite?: boolean; eager?: boolean }) {
  return (
    <img
      src={photoSrc(kind, lite)}
      srcSet={lite ? undefined : `${photoSrc(kind, true)} 450w, ${photoSrc(kind)} 900w`}
      sizes={lite ? undefined : "(max-width: 700px) 70vw, 420px"}
      alt=""
      width={lite ? 450 : 900}
      height={lite ? 600 : 1200}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={`scene ${className ?? ""}`}
      style={style}
      aria-hidden="true"
    />
  );
}

/** A developed print: white border, photo, handwritten-style caption. */
function PrintImpl({ kind, caption, className, style, lite = true, eager }: { kind: SceneKind; id?: string; caption?: string; className?: string; style?: CSSProperties; lite?: boolean; eager?: boolean }) {
  return (
    <figure className={`print ${className ?? ""}`} style={style}>
      <Scene kind={kind} className="print-img" lite={lite} eager={eager} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

// Memoised so scroll-driven re-renders of the story never re-diff the images.
export const Scene = memo(SceneImpl);
export const Print = memo(PrintImpl);

/* line icons for feature cards ------------------------------------------------ */
const iconProps = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
export const Icons = {
  angle: (
    <svg {...iconProps}><path d="M3 7l5-3h8l5 3v10l-5 3H8l-5-3z" /><circle cx="12" cy="12" r="3.2" /><path d="M12 4v2M12 18v2" /></svg>
  ),
  roll: (
    <svg {...iconProps}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 9h5v6h-5M6 6V4M9 6V4M12 6V4M6 20v-2M9 20v-2M12 20v-2" /></svg>
  ),
  reveal: (
    <svg {...iconProps}><path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 3-5 4-5 6" /></svg>
  ),
  download: (
    <svg {...iconProps}><path d="M12 4v11M7 10l5 5 5-5" /><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" /></svg>
  ),
};
