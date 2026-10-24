import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getRollBySlug, rollState, shotCount } from "@/lib/rolls";
import { currentMember } from "@/lib/auth";
import Camera from "./Camera";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Camera", robots: { index: false } };

export default async function CameraPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const roll = await getRollBySlug(slug);
  if (!roll) redirect(`/r/${slug}`);
  const member = await currentMember(roll);
  if (!member || rollState(roll).phase !== "shooting") redirect(`/r/${roll.slug}`);
  return (
    <Camera
      slug={roll.slug}
      eventName={roll.name}
      endsAt={roll.endsAt}
      guestName={member.name}
      look={roll.look}
      stamp={roll.dateStamp}
      total={roll.exposures}
      used={await shotCount(roll.id)}
      allowUploads={false}
      guestLooks={roll.guestLooks}
      shareable={roll.mode === "event"}
    />
  );
}
