import type { Metadata } from "next";
import Link from "next/link";
import { getRollBySlug, listPhotos, memberCount, rollState, shotCount } from "@/lib/rolls";
import { canView, currentMember, isOwner, ownerToken } from "@/lib/auth";
import { getT, siteOrigin } from "@/lib/i18n-server";
import { getPack } from "@/lib/packages";
import { LangToggle, Logo } from "@/components/ui";
import RollHome from "./RollHome";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const roll = await getRollBySlug((await params).slug);
  if (!roll) return { title: { absolute: "jepret by wolfpuplabs" }, robots: { index: false } };
  const description =
    roll.mode === "event"
      ? `Join ${roll.ownerName ? `${roll.ownerName}'s` : "this"} roll and shoot from your phone — no app needed.`
      : "A personal jepret roll.";
  return {
    title: roll.name,
    description,
    robots: { index: false },
    openGraph: { title: roll.name, description, siteName: "jepret by wolfpuplabs" },
  };
}

export default async function RollPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ baru?: string }> }) {
  const { slug } = await params;
  const { baru } = await searchParams;
  const { t } = await getT();
  const roll = await getRollBySlug(slug);
  if (!roll) {
    return (
      <div className="guest-page">
        <div className="gtop"><Link href="/" className="logo-link"><Logo light /></Link><LangToggle dark /></div>
        <div className="center-page"><div><h1>{t.roll.notFound}</h1><p className="muted">{t.roll.notFoundLead}</p></div></div>
      </div>
    );
  }
  const [owner, member, used, people, viewer] = await Promise.all([
    isOwner(roll), currentMember(roll), shotCount(roll.id), memberCount(roll.id), canView(roll),
  ]);
  if (!viewer && !member) {
    return (
      <div className="guest-page">
        <div className="gtop"><Link href="/" className="logo-link"><Logo light /></Link><LangToggle dark /></div>
        <div className="center-page"><div><h1>{t.roll.privateTitle}</h1><p className="muted">{t.roll.privateLead}</p></div></div>
      </div>
    );
  }
  const state = rollState(roll);
  const photos = state.phase === "developed" && viewer ? (await listPhotos(roll.id)).slice(-12).reverse() : [];
  const token = owner ? await ownerToken(roll) : null;
  const origin = await siteOrigin();
  const pack = getPack(roll.packageId);

  return (
    <RollHome
      roll={{
        slug: roll.slug, name: roll.name, mode: roll.mode, exposures: roll.exposures, price: roll.price,
        ownerName: roll.ownerName, endsAt: roll.endsAt, paid: roll.paid, iso: pack?.iso ?? 400,
      }}
      phase={state.phase}
      developAt={state.developAt}
      used={used}
      people={people}
      member={member ? { name: member.name } : null}
      owner={owner}
      ownerUrl={token ? `${origin}/k/${roll.slug}/${token}` : null}
      guestUrl={`${origin}/r/${roll.slug}`}
      isNew={baru === "1" && owner}
      preview={photos.map((p) => ({ id: p.id, thumbUrl: p.thumbUrl, guestName: p.guestName }))}
    />
  );
}
