import { NextResponse } from "next/server";
import { limitByClient, track } from "@/lib/guard";
import { query } from "@/lib/db";
import { hashToken, randomId, randomToken } from "@/lib/ids";
import { DEVELOP_MODES, getPack, type DevelopMode } from "@/lib/packages";
import { LOOKS } from "@/lib/filters";
import { makeSlug } from "@/lib/rolls";
import { setOwnerCookie } from "@/lib/auth";

export const runtime = "nodejs";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Loads a new roll. The creator becomes its owner (cookie + private link). */
export async function POST(req: Request) {
  // loading a roll is free; storage is only paid back at download, so cap free loads per address
  const limited = (await limitByClient(req, "create", 5, 3600)) || (await limitByClient(req, "create-day", 15, 86400));
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const pack = getPack(String(body.pack || ""));
  if (!pack) return NextResponse.json({ error: "pack" }, { status: 400 });
  const name = str(body.name, 80);
  if (!name) return NextResponse.json({ error: "name" }, { status: 400 });
  const ownerName = str(body.ownerName, 40) || null;

  let endsAt: Date | null = null;
  if (pack.mode === "event") {
    endsAt = body.endsAt ? new Date(body.endsAt) : new Date(Date.now() + 8 * 3600_000);
    if (isNaN(+endsAt) || endsAt.getTime() < Date.now() + 5 * 60_000) return NextResponse.json({ error: "ends" }, { status: 400 });
    // keep event rolls within a week
    endsAt = new Date(Math.min(endsAt.getTime(), Date.now() + 7 * 86400_000));
  }
  const developMode: DevelopMode = DEVELOP_MODES.includes(body.developMode) ? body.developMode : "hour";
  const look = LOOKS.some((l) => l.id === body.look) ? body.look : "film35";

  const id = randomId(14);
  const slug = makeSlug(name);
  const token = randomToken();
  await query(
    `insert into rolls (id, slug, mode, package, exposures, price, name, owner_name, owner_hash, look, guest_looks, date_stamp, develop_mode, ends_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      id, slug, pack.mode, pack.id, pack.exposures, pack.price, name, ownerName, hashToken(token), look,
      body.guestLooks !== false, body.dateStamp !== false, developMode, endsAt?.toISOString() ?? null,
    ]
  );
  await query(`insert into members (id, roll_id, name, is_owner) values ($1,$2,$3,true)`, [randomId(12), id, ownerName || (pack.mode === "event" ? "Host" : "Me")]);
  await track("created", id, pack.price);
  await setOwnerCookie(id, token);
  return NextResponse.json({ slug, ownerToken: token, mode: pack.mode });
}
