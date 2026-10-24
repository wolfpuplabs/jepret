import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function randomId(length = 12) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function randomToken() {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqualHex(a: string, b: string) {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
