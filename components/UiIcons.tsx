/* Small line icons shared by the guest screens. */
const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const CameraIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.4-2h5.8l1.4 2h2.2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" /><circle cx="12" cy="12.6" r="3.4" /></svg>
);
export const QrIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...p}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2h-2zM18 14h2M14 18v2M17 17h3v3h-3z" /></svg>
);
export const DownloadIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19h14" /></svg>
);
export const BackIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);
export const FlipIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" /><path d="M20 20v-4h-4" /></svg>
);
export const FlashIcon = ({ size = 22, off = false }: { size?: number; off?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M13 3 6 13h5l-1 8 7-10h-5z" />{off && <path d="M4 4l16 16" />}</svg>
);
export const GalleryIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></svg>
);

/* AR effect icons (24×24, stroke) */
const arPaths: Record<string, React.ReactNode> = {
  none: <><circle cx="12" cy="12" r="8" /><path d="M6.5 17.5 17.5 6.5" /></>,
  shades: <><path d="M3 9h18" /><path d="M4 9c0 4 1.5 6 4 6s3.5-2 3.5-6M20 9c0 4-1.5 6-4 6s-3.5-2-3.5-6" /></>,
  partyhat: <><path d="M6 20 12 4l6 16z" /><path d="M8.5 13l6.5-3M7.5 17l8-3.5" /><circle cx="12" cy="3.5" r="1.2" /></>,
  crown: <><path d="M4 18h16l1-10-5 4-4-7-4 7-5-4z" /></>,
  mustache: <><path d="M12 11c-2-2-5-2-6.5 0S4 15 2.5 13.5C4 17 9 16 12 13c3 3 8 4 9.5.5-1.5 1.5-2-1.5-3.5-3.5S14 9 12 11z" /></>,
  bunny: <><path d="M9 13C7 9 6.5 4 8 3s3 4 3 9M15 13c2-4 2.5-9 1-10s-3 4-3 9" /><path d="M6 15a6 6 0 0 1 12 0" /></>,
  flowers: <><circle cx="6" cy="12" r="2" /><circle cx="12" cy="9" r="2" /><circle cx="18" cy="12" r="2" /><path d="M3 15c3-3 15-3 18 0" /></>,
  sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" /></>,
  hearts: <><path d="M12 20s-7-4.4-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.5C19 15.6 12 20 12 20z" /></>,
  bowtie: <><path d="M12 12 4 7v10zM12 12l8-5v10z" /><circle cx="12" cy="12" r="1.6" /></>,
  wings: <><path d="M11 12C8 6 3 5 2 7c2 0 3 2 3 3-2 0-3 2-2 3 2-1 3 0 3 1 2 0 5-1 5-2zM13 12c3-6 8-7 9-5-2 0-3 2-3 3 2 0 3 2 2 3-2-1-3 0-3 1-2 0-5-1-5-2z" /></>,
};
export const ArIcon = ({ id, size = 26 }: { id: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...p}>{arPaths[id] ?? arPaths.none}</svg>
);
export const ArButtonIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...p}><circle cx="12" cy="13" r="6" /><path d="M9.5 12h.01M14.5 12h.01M10 15.2c1.2.9 2.8.9 4 0" /><path d="M18 3l.7 1.8 1.8.7-1.8.7L18 8l-.7-1.8L15.5 5.5l1.8-.7z" /></svg>
);
