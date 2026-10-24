import "server-only";
import { cookies } from "next/headers";
import { one } from "./db";
import { hashToken, safeEqualHex } from "./ids";
import type { RollData } from "./rolls";

/**
 * No accounts. The roll owner holds a secret token (cookie + private link),
 * guests of an event roll hold a member token. Both are stored hashed.
 */
const YEAR = 60 * 60 * 24 * 365;
const ownerCookie = (rollId: string) => `jo_${rollId}`;
const memberCookie = (rollId: string) => `jm_${rollId}`;
const opts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: YEAR,
};

export async function setOwnerCookie(rollId: string, token: string) {
  (await cookies()).set(ownerCookie(rollId), token, opts);
}
export async function setMemberCookie(rollId: string, token: string) {
  (await cookies()).set(memberCookie(rollId), token, opts);
}

export async function verifyOwnerToken(roll: RollData, token: string | null | undefined) {
  if (!token) return false;
  const row = await one<{ owner_hash: string }>(`select owner_hash from rolls where id = $1`, [roll.id]);
  return !!row && safeEqualHex(row.owner_hash, hashToken(token));
}

export async function isOwner(roll: RollData) {
  return verifyOwnerToken(roll, (await cookies()).get(ownerCookie(roll.id))?.value);
}

/** The raw owner token (to show the private link again), only when valid. */
export async function ownerToken(roll: RollData) {
  const token = (await cookies()).get(ownerCookie(roll.id))?.value;
  return (await verifyOwnerToken(roll, token)) ? token! : null;
}

export type Member = { id: string; name: string; isOwner: boolean };

/** The person shooting on this device: the owner, or a guest who joined. */
export async function currentMember(roll: RollData): Promise<Member | null> {
  if (await isOwner(roll)) {
    const m = await one<{ id: string; name: string }>(
      `select id, name from members where roll_id = $1 and is_owner = true limit 1`,
      [roll.id]
    );
    if (m) return { ...m, isOwner: true };
  }
  const token = (await cookies()).get(memberCookie(roll.id))?.value;
  if (!token) return null;
  const m = await one<{ id: string; name: string }>(
    `select id, name from members where roll_id = $1 and token_hash = $2`,
    [roll.id, hashToken(token)]
  );
  return m ? { ...m, isOwner: false } : null;
}

/** Who may see the developed photos: personal rolls are private to the owner. */
export async function canView(roll: RollData) {
  if (roll.mode === "event") return true;
  return isOwner(roll);
}
