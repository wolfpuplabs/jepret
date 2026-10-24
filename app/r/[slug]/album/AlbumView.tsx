"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Paywall, { LockIcon, type PayCfg } from "@/components/Paywall";
import { useT } from "@/components/I18n";
import { LocalTime } from "@/components/ui";
import { Gallery, type GPhoto } from "@/components/Gallery";
import { rupiah } from "@/lib/packages";

export default function AlbumView({ slug, name, event, exposures, price, photos, unlocked, pay, expires, initialOrder }: {
  slug: string; name: string; event: boolean; exposures: number; price: number; photos: GPhoto[];
  unlocked: boolean; pay: PayCfg; expires: string; initialOrder: string | null;
}) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const locked = !unlocked;

  return (
    <>
      <p className="small muted" style={{ margin: "0 0 14px" }}>
        ⏳ {t.roll.expires} <b><LocalTime iso={expires} mode="date" /></b>
      </p>
      {locked && photos.length > 0 ? (
        <button type="button" className="unlock-strip" onClick={() => setOpen(true)}>
          <span className="pw-lock"><LockIcon size={16} /></span>
          <span className="us-text"><b>{t.pay.title}</b><small>{t.pay.strip.replace("{p}", rupiah(price))} · {t.pay.methods}</small></span>
          <span className="us-price">{rupiah(price)}</span>
        </button>
      ) : pay.enabled && photos.length > 0 ? (
        <p className="unlock-done">✓ {t.pay.paid}</p>
      ) : null}
      <Gallery slug={slug} eventName={name} photos={photos} locked={locked} onLocked={() => setOpen(true)} />
      {pay.enabled && (
        <Paywall
          slug={slug}
          cfg={pay}
          price={price}
          exposures={exposures}
          event={event}
          open={open}
          initialOrder={initialOrder}
          onClose={() => setOpen(false)}
          onUnlocked={() => { setOpen(false); router.replace(`/r/${slug}/album`); router.refresh(); }}
        />
      )}
    </>
  );
}
