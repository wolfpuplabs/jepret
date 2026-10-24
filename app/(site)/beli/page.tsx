import type { Metadata } from "next";
import { packages } from "@/lib/packages";
import BuyRoll from "./BuyRoll";

export const metadata: Metadata = { title: "Get a roll" };
export const dynamic = "force-dynamic";

export default async function BuyPage({ searchParams }: { searchParams: Promise<{ pack?: string }> }) {
  const { pack } = await searchParams;
  return <BuyRoll packs={packages()} initialPack={pack ?? null} />;
}
