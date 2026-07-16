import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cryptoConfig } from "./env.js";

// ─────────────────────────────────────────────────────────────
// Password hashing (bcrypt, cost 12)
// ─────────────────────────────────────────────────────────────
export async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

// bcrypt hash (cost 12) of a throwaway random secret that was never recorded.
// Nothing can verify against it — it exists only to be compared against.
const ABSENT_USER_HASH = "$2a$12$TDj8u5NWN.0icncipPS8B.OUITv0fLOZrQIOmRsJT46LzSa776JQ2";

/**
 * Always false, but costs the same bcrypt work as a real verify.
 *
 * Login must not answer faster for an unknown email than for a known one with
 * the wrong password: that difference is remotely measurable and turns the
 * login form into an "is this address registered?" oracle. Burning an
 * equivalent compare on the unknown-email path keeps the two indistinguishable.
 */
export async function verifyAbsentUser(plain) {
  await bcrypt.compare(plain, ABSENT_USER_HASH);
  return false;
}

// ─────────────────────────────────────────────────────────────
// Field-level encryption — AES-256-GCM (authenticated).
// Stored format:  ivHex:authTagHex:cipherHex
// ─────────────────────────────────────────────────────────────
function getKey() {
  // cryptoConfig() validates ENCRYPTION_KEY is exactly 64 hex chars (32 bytes).
  return Buffer.from(cryptoConfig().encryptionKey, "hex");
}

export function encrypt(plaintext) {
  if (plaintext == null || plaintext === "") return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decrypt(payload) {
  if (!payload) return null;
  // Resolve the key outside the try: a config error must propagate, while a
  // genuine decrypt failure (tampered/corrupt ciphertext) still returns null.
  const key = getKey();
  try {
    const [ivHex, tagHex, dataHex] = payload.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

// Cryptographically-strong random password for admin resets.
export function generateTempPassword(len = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#%&*";
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
