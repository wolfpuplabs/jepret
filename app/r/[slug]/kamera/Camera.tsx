"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useT } from "@/components/I18n";
import { useShortCountdown } from "@/components/ui";
import ShareSheet from "@/components/ShareSheet";
import { ArButtonIcon, ArIcon, BackIcon, FlashIcon, FlipIcon, GalleryIcon, QrIcon } from "@/components/UiIcons";
import { AR_EFFECTS, detect, drawEffect, getEffect, loadTracker } from "@/lib/ar";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { getLook, LOOKS } from "@/lib/filters";
import LookThumb from "@/components/LookThumb";
import { developFrame, loadImageFile, type Processed } from "@/lib/image-client";

type Props = {
  slug: string;
  eventName: string;
  endsAt: string | null;
  guestName: string;
  look: string;
  stamp: boolean;
  total: number;
  used: number;
  allowUploads: boolean;
  guestLooks: boolean;
  shareable: boolean;
};

type Job = { shot: Processed; source: "camera" | "upload" };
type Caps = { zoom?: { min: number; max: number }; torch?: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Camera({ slug, eventName, endsAt, look: hostLook, stamp, total, used, allowUploads, guestLooks, shareable }: Props) {
  const { t, lang } = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [camState, setCamState] = useState<"starting" | "on" | "denied" | "none">("starting");
  const [left, setLeft] = useState(Math.max(0, total - used));
  const [flash, setFlash] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [lastThumb, setLastThumb] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [zoomLevels, setZoomLevels] = useState<number[]>([1, 2]);
  const [zoom, setZoom] = useState(1);
  const [nativeZoom, setNativeZoom] = useState(false);
  const [torchAvail, setTorchAvail] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const toEnd = useShortCountdown(endsAt ?? new Date().toISOString());
  const queue = useRef<Job[]>([]);
  const working = useRef(false);
  // Guests may pick their own look (host's look is the default); the choice sticks per event.
  const lookKey = `jepret-look-${slug}`;
  const [look, setLook] = useState(hostLook);
  const [picker, setPicker] = useState(false);
  useEffect(() => {
    if (!guestLooks) return setLook(hostLook);
    try {
      const saved = localStorage.getItem(lookKey);
      if (saved && LOOKS.some((l) => l.id === saved)) setLook(saved);
    } catch { /* storage unavailable */ }
  }, [guestLooks, hostLook, lookKey]);
  const chooseLook = (id: string) => {
    setLook(id);
    try { localStorage.setItem(lookKey, id); } catch { /* ignore */ }
  };
  const lk = getLook(look);

  // AR accessories: tracking runs on the live video; accessories are drawn on a
  // canvas laid exactly over it and merged into the photo when the shutter fires.
  const arCanvasRef = useRef<HTMLCanvasElement>(null);
  const [arId, setArId] = useState<string | null>(null);
  const [arOpen, setArOpen] = useState(false);
  const [arStatus, setArStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [arSeen, setArSeen] = useState(true);
  const arEffect = getEffect(arId);

  const showToast = useCallback((msg: string, ms = 1600) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), ms);
  }, []);

  const stop = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };

  const start = useCallback(async (mode: "environment" | "user") => {
    stop();
    if (!navigator.mediaDevices?.getUserMedia) return setCamState("none");
    setCamState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: mode }, width: { ideal: 2560 }, height: { ideal: 1920 } },
      });
      streamRef.current = stream;
      // optical/native zoom and torch where the browser exposes them (mostly Android);
      // otherwise fall back to a centre-crop digital zoom.
      const track = stream.getVideoTracks()[0] as MediaStreamTrack | undefined;
      const caps = (track?.getCapabilities?.() ?? {}) as unknown as Caps;
      if (caps.zoom && caps.zoom.max > caps.zoom.min) {
        const lv = [0.5, 1, 2, 3].filter((z) => z >= caps.zoom!.min - 0.01 && z <= caps.zoom!.max + 0.01);
        setZoomLevels(lv.length ? lv : [1]);
        setNativeZoom(true);
        track?.applyConstraints({ advanced: [{ zoom: 1 } as MediaTrackConstraintSet] }).catch(() => {});
      } else {
        setZoomLevels([1, 2]);
        setNativeZoom(false);
      }
      setZoom(1);
      setTorchAvail(!!caps.torch);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCamState("on");
    } catch (e) {
      const name = (e as Error).name;
      setCamState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "none");
    }
  }, []);

  useEffect(() => {
    if (left > 0) start(facing);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  // iOS kills the stream when the tab is backgrounded; restart on return.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") stop();
      else if (left > 0) start(facing);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [facing, left, start]);

  const pickZoom = (z: number) => {
    setZoom(z);
    if (nativeZoom) {
      const track = streamRef.current?.getVideoTracks()[0];
      track?.applyConstraints({ advanced: [{ zoom: z } as MediaTrackConstraintSet] }).catch(() => {});
    }
  };

  const torch = (on: boolean) =>
    streamRef.current?.getVideoTracks()[0]?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).catch(() => {});

  useEffect(() => {
    const eff = getEffect(arId);
    const cv = arCanvasRef.current;
    const clear = () => cv?.getContext("2d")?.clearRect(0, 0, cv.width, cv.height);
    if (!eff || !cv) {
      clear();
      setArStatus("idle");
      return;
    }
    let stopped = false;
    let raf = 0;
    let lastDetect = 0;
    let lastSeen = performance.now();
    let seen = true;
    let sets: NormalizedLandmark[][] = [];
    setArStatus("loading");
    setArSeen(true);
    loadTracker(eff.kind)
      .then((tracker) => {
        if (stopped) return;
        setArStatus("ready");
        const tick = (now: number) => {
          if (stopped) return;
          const v = videoRef.current;
          const ctx = cv.getContext("2d");
          if (v && ctx && v.videoWidth && v.readyState >= 2) {
            if (cv.width !== v.videoWidth || cv.height !== v.videoHeight) {
              cv.width = v.videoWidth;
              cv.height = v.videoHeight;
            }
            if (now - lastDetect > 60) {
              lastDetect = now;
              try {
                sets = detect(eff.kind, tracker, v);
                if (sets.length) lastSeen = now;
              } catch { /* skip this frame */ }
            }
            ctx.clearRect(0, 0, cv.width, cv.height);
            drawEffect(ctx, eff, sets, cv.width, cv.height, now / 1000);
            const s = now - lastSeen < 1500;
            if (s !== seen) {
              seen = s;
              setArSeen(s);
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (stopped) return;
        setArId(null);
        setArStatus("idle");
        showToast(t.guest.arError, 2800);
      });
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clear();
    };
  }, [arId, showToast, t.guest.arError]);

  const pump = useCallback(async () => {
    if (working.current) return;
    working.current = true;
    while (queue.current.length) {
      const job = queue.current[0];
      let ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        try {
          const fd = new FormData();
          fd.set("full", job.shot.full, "photo.jpg");
          fd.set("thumb", job.shot.thumb, "thumb.jpg");
          fd.set("width", String(job.shot.width));
          fd.set("height", String(job.shot.height));
          fd.set("source", job.source);
          const r = await fetch(`/api/r/${slug}/photos`, { method: "POST", body: fd });
          const j = await r.json().catch(() => ({}));
          if (r.ok) {
            ok = true;
            setLeft(j.left);
            showToast(`✓ ${t.guest.savedShot}`);
          } else if (j.error === "roll_done" || j.error === "ended") {
            queue.current = [];
            setLeft(0);
            ok = true;
          } else if (r.status < 500) {
            ok = true; // not retryable
            showToast(t.common.error, 2500);
          } else {
            await new Promise((res) => setTimeout(res, 1200 * (attempt + 1)));
          }
        } catch {
          await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
        }
      }
      if (!ok) showToast(t.common.error, 2500);
      queue.current.shift();
      setPending(queue.current.length);
    }
    working.current = false;
  }, [slug, showToast, t]);

  const enqueue = (shot: Processed, source: Job["source"]) => {
    queue.current.push({ shot, source });
    setPending(queue.current.length);
    const url = URL.createObjectURL(shot.thumb);
    setLastThumb((old) => {
      if (old) URL.revokeObjectURL(old);
      return url;
    });
    pump();
  };

  const shoot = async () => {
    const v = videoRef.current;
    if (!v || camState !== "on" || left - pending <= 0 || !v.videoWidth) return;
    const optimisticLeft = left - pending - 1;
    const useTorch = flashOn && torchAvail;
    const useScreen = flashOn && !torchAvail && facing === "user";
    try {
      if (useTorch) { await torch(true); await sleep(260); }
      if (useScreen) { setScreenFlash(true); await sleep(160); }
      setFlash((n) => n + 1);
      if ("vibrate" in navigator) navigator.vibrate?.(30);
      const shot = await developFrame(v, v.videoWidth, v.videoHeight, {
        look, stamp, mirror: facing === "user", zoom: nativeZoom ? 1 : zoom,
        overlay: arEffect && arStatus === "ready" ? arCanvasRef.current : null,
      });
      if (useTorch) torch(false);
      setScreenFlash(false);
      enqueue(shot, "camera");
      if (optimisticLeft <= 0) stop();
    } catch {
      setScreenFlash(false);
      if (useTorch) torch(false);
      showToast(t.common.error, 2500);
    }
  };

  const fromGallery = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = left - pending;
    const list = Array.from(files).slice(0, Math.max(0, room));
    for (const file of list) {
      try {
        const { src, w, h, date } = await loadImageFile(file);
        const shot = await developFrame(src, w, h, { look, stamp, date });
        enqueue(shot, "upload");
      } catch {
        showToast(t.common.error, 2500);
      }
    }
  };

  const remaining = Math.max(0, left - pending);
  const done = remaining <= 0;
  const d = new Date();
  const stampText = `'${String(d.getFullYear()).slice(2)}  ${String(d.getMonth() + 1).padStart(2, "0")}  ${String(d.getDate()).padStart(2, "0")}`;

  const flashUsable = torchAvail || facing === "user";
  const dial = [remaining + 1, remaining, remaining - 1];

  return (
    <div className="cam">
      <div className="c2-top">
        <Link href={`/r/${slug}`} className="c2-round" aria-label={t.common.back}><BackIcon /></Link>
        <div className="c2-title">
          <b>{eventName}</b>
          <small suppressHydrationWarning>{endsAt ? `${toEnd} ${t.guest.left}` : `${remaining}/${total} ${t.common.shots}`}</small>
        </div>
        {shareable ? <button type="button" className="c2-round c2-sq" onClick={() => setShareOpen(true)} aria-label={t.guest.shareTitle}><QrIcon /></button> : <span />}
      </div>

      <div className="c2-view">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{
            filter: lk.css,
            opacity: camState === "on" && !done ? 1 : 0.15,
            transform: `${facing === "user" ? "scaleX(-1) " : ""}scale(${nativeZoom ? 1 : zoom})`,
          }}
        />
        <canvas
          ref={arCanvasRef}
          className="c2-ar"
          aria-hidden="true"
          style={{
            filter: lk.css,
            display: arEffect && camState === "on" && !done ? "block" : "none",
            transform: `${facing === "user" ? "scaleX(-1) " : ""}scale(${nativeZoom ? 1 : zoom})`,
          }}
        />
        <div className="cam-vignette" />
        {lk.overlay && camState === "on" && !done && <div className="c2-overlay" style={{ background: lk.overlay }} />}
        {guestLooks ? (
          <button type="button" className={`c2-look c2-look-btn ${picker ? "on" : ""}`} onClick={() => { setPicker((v) => !v); setArOpen(false); }} aria-expanded={picker} aria-label={t.guest.pickLook}>
            {lk.name[lang]} <span aria-hidden="true">▾</span>
          </button>
        ) : (
          <span className="c2-look">{lk.name[lang]}</span>
        )}
        {guestLooks && picker && !done && (
          <div className="c2-looks" role="radiogroup" aria-label={t.guest.pickLook}>
            {LOOKS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={look === l.id}
                className={`c2-lk ${look === l.id ? "on" : ""}`}
                onClick={() => chooseLook(l.id)}
              >
                <LookThumb look={l} />
                <span>{l.name[lang]}</span>
              </button>
            ))}
          </div>
        )}
        {camState === "on" && !done && (
          <button
            type="button"
            className={`c2-ar-btn ${arEffect ? "active" : ""} ${arOpen ? "on" : ""}`}
            onClick={() => { setArOpen((v) => !v); setPicker(false); }}
            aria-expanded={arOpen}
            aria-label={t.guest.arPick}
          >
            {arEffect ? <ArIcon id={arEffect.id} size={18} /> : <ArButtonIcon />} {t.guest.ar}
          </button>
        )}
        {arOpen && !done && (
          <div className="c2-looks c2-ars" role="radiogroup" aria-label={t.guest.arPick}>
            {[{ id: "none", name: { id: t.guest.arNone, en: t.guest.arNone } }, ...AR_EFFECTS].map((e) => {
              const on = (arId ?? "none") === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`c2-lk ${on ? "on" : ""}`}
                  onClick={() => setArId(e.id === "none" ? null : e.id)}
                >
                  <span className="c2-ar-ico">
                    <ArIcon id={e.id} />
                    {on && arStatus === "loading" && <i className="c2-spin" />}
                  </span>
                  <span>{e.name[lang]}</span>
                </button>
              );
            })}
          </div>
        )}
        {arEffect && camState === "on" && !done && (arStatus === "loading" || !arSeen) && (
          <span className="c2-ar-hint">
            {arStatus === "loading"
              ? t.guest.arLoading
              : arEffect.kind === "face" ? t.guest.arHintFace : arEffect.kind === "hand" ? t.guest.arHintHand : t.guest.arHintPose}
          </span>
        )}
        {stamp && camState === "on" && !done && <span className="c2-stamp">{stampText}</span>}
        <div key={flash} className={`cam-flash ${flash ? "go" : ""}`} />
        {done ? (
          <div className="cam-msg">
            <p style={{ margin: "0 0 14px" }}>🎞️ {t.guest.rollDone}</p>
            <Link href={`/r/${slug}`} className="btn btn-light btn-small">{eventName} →</Link>
          </div>
        ) : camState === "denied" || camState === "none" ? (
          <div className="cam-msg">{camState === "denied" ? t.guest.camDenied : t.guest.camNone}</div>
        ) : null}
      </div>

      <div className="c2-tools">
        <button
          type="button"
          className={`c2-icon ${flashOn ? "on" : ""}`}
          onClick={() => setFlashOn((f) => !f)}
          aria-pressed={flashOn}
          aria-label={t.guest.flash}
          disabled={done || !flashUsable}
          style={{ visibility: flashUsable ? "visible" : "hidden" }}
        >
          <FlashIcon off={!flashOn} />
        </button>
        <div className="c2-zoom" role="group" aria-label={t.guest.zoom}>
          {zoomLevels.map((z) => (
            <button key={z} type="button" className={zoom === z ? "on" : ""} onClick={() => pickZoom(z)} disabled={done}>
              {zoom === z ? `${z}×` : z}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="c2-icon"
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          aria-label={t.guest.flip}
          disabled={done}
        >
          <FlipIcon />
        </button>
      </div>

      <div className="c2-bar">
        <div className={`c2-dial ${remaining <= 3 ? "low" : ""}`} title={t.guest.shotsLeft} aria-label={`${remaining} ${t.guest.shotsLeft}`}>
          <span aria-hidden="true">{dial[0] <= total ? dial[0] : ""}</span>
          <b key={remaining}>{dial[1]}</b>
          <span aria-hidden="true">{dial[2] >= 0 ? dial[2] : ""}</span>
        </div>
        <button className="shutter" onClick={shoot} disabled={done || camState !== "on"} aria-label={t.guest.shoot} />
        {allowUploads ? (
          <label className="c2-thumb" aria-label={t.guest.upload} title={t.guest.upload} style={{ opacity: done ? 0.35 : 1 }}>
            {lastThumb ? <img src={lastThumb} alt="" /> : <GalleryIcon />}
            <input type="file" accept="image/*" multiple hidden disabled={done} onChange={(e) => { fromGallery(e.target.files); e.target.value = ""; }} />
          </label>
        ) : (
          <span className="c2-thumb" aria-hidden="true">{lastThumb ? <img src={lastThumb} alt="" /> : null}</span>
        )}
      </div>

      {screenFlash && <div className="c2-screenflash" />}
      {(toast || pending > 0) && <div className="toast">{toast || `${t.guest.saving} (${pending})`}</div>}
      <ShareSheet path={`/r/${slug}`} title={eventName} open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
