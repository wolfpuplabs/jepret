import "server-only";
import { cookies, headers } from "next/headers";
import { getDict, type Lang } from "./i18n";

export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get("lang")?.value;
  if (c === "en" || c === "id") return c;
  // English is the default; Indonesian is one tap away via the ID/EN toggle.
  return "en";
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: getDict(lang) };
}

export async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
