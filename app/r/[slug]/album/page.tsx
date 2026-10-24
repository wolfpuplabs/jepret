import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { expiresAt, getRollBySlug, listPhotos, rollState } from "@/lib/rolls";
import { canView } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { canDownload, publicPayConfig, reconcilePending } from "@/lib/payments";
import { LangToggle, Logo } from "@/components/ui";
import AlbumView from "./AlbumView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Photos", robots: { index: false } };

export default async function AlbumPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ order?: string }> }) {
  const { slug } = await params;
  const { order } = await searchParams;
  let roll = await getRollBySlug(slug);
  if (!roll) redirect(`/r/${slug}`);
  const state = rollState(roll);
  if (state.phase !== "developed" || !(await canView(roll))) redirect(`/r/${roll.slug}`);
  await reconcilePending(roll).catch(() => null);
  roll = (await getRollBySlug(slug)) ?? roll;
  const { t } = await getT();
  const unlocked = canDownload(roll);
  const photos = (await listPhotos(roll.id)).map((p) => ({ ...p, url: unlocked ? p.url : p.thumbUrl }));

  return (
    <div className="album-page">
      <header className="site-header">
        <div className="wrap">
          <Link href="/" className="logo-link"><Logo /></Link>
          <nav><LangToggle /></nav>
        </div>
      </header>
      <div className="wrap">
        <div className="album-head">
          <Link href={`/r/${roll.slug}`} className="small muted" style={{ textDecoration: "none" }}>← {roll.name}</Link>
          <h1 style={{ fontSize: "clamp(30px,5vw,44px)", marginTop: 8 }}>{t.roll.developed}</h1>
        </div>
        <AlbumView
          slug={roll.slug}
          name={roll.name}
          event={roll.mode === "event"}
          exposures={roll.exposures}
          price={roll.price}
          photos={photos}
          unlocked={unlocked}
          pay={publicPayConfig()}
          expires={expiresAt(state.developAt!)}
          initialOrder={order && /^[A-Z0-9-]{6,60}$/.test(order) ? order : null}
        />
      </div>
    </div>
  );
}
