import crypto from "crypto";
import { query } from "./db.js";

// Tokenized links that let a facility invite a provider to complete their own
// section externally, without a login. The URL carries an opaque token; access
// additionally requires a short security key. Only SHA-256 hashes of both are
// stored, so a database leak cannot reconstruct a working link.

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

/** URL-safe token (identifies the link). */
function newToken() {
  return crypto.randomBytes(24).toString("base64url");
}

/** Human-enterable security key, e.g. "7QK2-9FMD-4XZP". */
function newSecurityKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const raw = crypto.randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) out += "-";
    out += alphabet[raw[i] % alphabet.length];
  }
  return out;
}

/**
 * Create a link for a provider slot. Returns the raw token + security key ONCE
 * (only hashes are persisted). `expiresInDays` defaults to 14.
 */
export async function createProviderLink({
  clientId,
  facilityNpi,
  providerKey,
  label,
  createdBy,
  expiresInDays = 14,
}) {
  const token = newToken();
  const key = newSecurityKey();
  const expires = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const result = await query(
    `INSERT INTO provider_access_links
       (client_id, facility_npi, provider_key, token_hash, key_hash, label, expires_at, created_by)
     VALUES
       (:clientId, :facilityNpi, :providerKey, :tokenHash, :keyHash, :label, :expires, :createdBy)`,
    {
      clientId,
      facilityNpi: facilityNpi || null,
      providerKey: providerKey || null,
      tokenHash: sha256(token),
      keyHash: sha256(key),
      label: label || null,
      expires,
      createdBy: createdBy ?? null,
    }
  );

  return { id: result.insertId, token, key, expiresAt: expires.toISOString() };
}

/** Resolve a link row by its raw token (does not check the key). */
export async function resolveLink(token) {
  if (!token) return null;
  const rows = await query(
    `SELECT id, client_id, facility_npi, provider_key, key_hash, label,
            expires_at, used_at, revoked_at,
            auth_setup, auth_method, provider_key_hash, provider_npi
       FROM provider_access_links WHERE token_hash = :h LIMIT 1`,
    { h: sha256(token) }
  );
  return rows[0] || null;
}

/** True when the link is usable (exists, not revoked, not expired). */
export function isLinkActive(row) {
  if (!row || row.revoked_at) return false;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return false;
  return true;
}

/** Constant-time compare of a stored sha256 hex against a plaintext value. */
function hashEquals(storedHex, plaintext) {
  if (!storedHex || !plaintext) return false;
  const a = Buffer.from(storedHex);
  const b = Buffer.from(sha256(plaintext));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Constant-time check of the provided security key against the stored temp-key
 *  hash (kept for the original invite key). */
export function verifyKey(row, key) {
  return hashEquals(row?.key_hash, key);
}

/**
 * Verify any accepted credential for a link and report HOW it matched:
 *  - "temp": the original invite key (always valid)
 *  - "key":  the provider's self-set security key
 *  - "npi":  the provider's individual NPI (only if they configured NPI auth)
 * Returns the method string, or null if nothing matched.
 */
export function verifyCredential(row, credential) {
  if (!row || !credential) return null;
  const cred = String(credential).trim();
  if (hashEquals(row.key_hash, cred)) return "temp";
  if (hashEquals(row.provider_key_hash, cred)) return "key";
  if (row.auth_method === "npi" && row.provider_npi) {
    const digits = cred.replace(/\D/g, "");
    if (digits && digits === String(row.provider_npi)) return "npi";
  }
  return null;
}

export function needsSetup(row) {
  return !row?.auth_setup;
}

/** Persist the provider's chosen future-access method. */
export async function setupProviderAuth(linkId, { method, key, npi }) {
  if (method === "key") {
    await query(
      "UPDATE provider_access_links SET auth_setup=1, auth_method='key', provider_key_hash=:h, provider_npi=NULL WHERE id=:id",
      { h: sha256(String(key)), id: linkId }
    );
  } else if (method === "npi") {
    await query(
      "UPDATE provider_access_links SET auth_setup=1, auth_method='npi', provider_npi=:npi, provider_key_hash=NULL WHERE id=:id",
      { npi: String(npi).replace(/\D/g, ""), id: linkId }
    );
  }
}

/** Stamp the link as used (first successful open). */
export async function markLinkUsed(id) {
  await query(
    "UPDATE provider_access_links SET used_at = COALESCE(used_at, CURRENT_TIMESTAMP) WHERE id = :id",
    { id }
  );
}

/** List a client's links for the UI (no secrets). */
export async function listProviderLinks(clientId) {
  const rows = await query(
    `SELECT id, provider_key, label, facility_npi, expires_at, used_at, revoked_at, created_at
       FROM provider_access_links
      WHERE client_id = :clientId AND revoked_at IS NULL
      ORDER BY created_at DESC`,
    { clientId }
  );
  return rows.map((r) => ({
    id: r.id,
    provider_key: r.provider_key,
    label: r.label,
    facility_npi: r.facility_npi,
    expires_at: r.expires_at,
    used_at: r.used_at,
    created_at: r.created_at,
  }));
}
