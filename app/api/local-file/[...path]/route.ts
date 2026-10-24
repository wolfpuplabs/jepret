import { NextResponse } from "next/server";
import { isLocalDev } from "@/lib/db";

export const runtime = "nodejs";

/** Serves uploaded files during local development (LOCAL_DEV=1). Disabled in production. */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (!isLocalDev()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { path: parts } = await ctx.params;
  if (parts.some((p) => p.includes(".."))) return NextResponse.json({ error: "bad" }, { status: 400 });
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  try {
    const buf = await fs.readFile(path.join(".local-data/files", ...parts));
    return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "image/jpeg" } });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
