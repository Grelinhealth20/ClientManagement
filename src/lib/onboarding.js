import crypto from "crypto";
import { query, writeAudit, withTransaction } from "./db.js";
import { encrypt, decrypt } from "./crypto.js";
import { bucket, clientPrefix, slugify } from "./s3.js";

// Server-side helpers for the onboarding workspace. The in-progress form state
// is stored as a single AES-256-GCM encrypted JSON blob per client (it holds
// portal passwords), and every document is a row scoped to the client.

export const TOTAL_STEPS = 4;

/** Load a client's draft, decrypting the blob. Returns a stable default shape
 *  when the client has never started. */
export async function loadDraft(clientId) {
  const rows = await query(
    `SELECT current_step, status, data_enc, reference_code, submitted_at, approved_at, updated_at
       FROM onboarding_drafts WHERE client_id = :clientId LIMIT 1`,
    { clientId }
  );
  if (!rows.length) {
    return {
      current_step: 1,
      status: "in_progress",
      data: {},
      reference_code: null,
      submitted_at: null,
      approved_at: null,
      updated_at: null,
    };
  }
  const r = rows[0];
  let data = {};
  if (r.data_enc) {
    try {
      data = JSON.parse(decrypt(r.data_enc) || "{}");
    } catch {
      data = {};
    }
  }
  return {
    current_step: r.current_step,
    status: r.status,
    data,
    reference_code: r.reference_code,
    submitted_at: r.submitted_at,
    approved_at: r.approved_at,
    updated_at: r.updated_at,
  };
}

// A generous ceiling on the encoded draft — it only holds form fields, so this
// is far above any legitimate use while still stopping a runaway/oversized blob.
export const MAX_DRAFT_BYTES = 1024 * 1024; // 1 MB

function encodeGuarded(obj) {
  const jsonStr = JSON.stringify(obj ?? {});
  if (Buffer.byteLength(jsonStr, "utf8") > MAX_DRAFT_BYTES) {
    const err = new Error("Draft is too large to save.");
    err.code = "DRAFT_TOO_LARGE";
    throw err;
  }
  return encrypt(jsonStr);
}

function clampStep(v, fallback) {
  const n = Number(v);
  return Number.isInteger(n) ? Math.min(Math.max(n, 1), TOTAL_STEPS) : fallback;
}

/** Idempotently ensure a draft row exists so merge-writers can lock + update it
 *  without an insert race. Safe under concurrency (INSERT IGNORE). */
async function ensureDraftRow(clientId) {
  await query(
    "INSERT IGNORE INTO onboarding_drafts (client_id, current_step) VALUES (:c, 1)",
    { c: clientId }
  );
}

/** Decrypt a draft's JSON blob, tolerating an empty/corrupt value. */
function decodeData(enc) {
  if (!enc) return {};
  try {
    return JSON.parse(decrypt(enc) || "{}") || {};
  } catch {
    return {};
  }
}

/**
 * Merge a partial patch into the draft ATOMICALLY (row-locked read-merge-write),
 * so concurrent writers editing different top-level sections (facility /
 * providers / systemAccess) never clobber each other. Only the keys present in
 * `patch` are replaced; everything else is preserved from the current blob.
 */
export async function patchDraft(clientId, { patch, current_step }) {
  const safePatch = patch && typeof patch === "object" ? patch : {};
  await ensureDraftRow(clientId);
  return withTransaction(async (tx) => {
    const rows = await tx(
      "SELECT data_enc, current_step FROM onboarding_drafts WHERE client_id = :c FOR UPDATE",
      { c: clientId }
    );
    const current = decodeData(rows[0]?.data_enc);
    const merged = { ...current, ...safePatch };
    const enc = encodeGuarded(merged);
    const step = clampStep(current_step, rows[0]?.current_step ?? 1);
    await tx(
      `UPDATE onboarding_drafts
          SET data_enc = :enc, current_step = :step,
              status = IF(status = 'approved', 'approved', 'in_progress'),
              updated_at = CURRENT_TIMESTAMP
        WHERE client_id = :c`,
      { enc, step, c: clientId }
    );
    const [r] = await tx("SELECT updated_at FROM onboarding_drafts WHERE client_id = :c", { c: clientId });
    return { updated_at: r?.updated_at ?? null };
  });
}

/**
 * Insert/update a SINGLE provider inside the draft's providers array, atomically.
 * Used by the external provider-intake so a provider filling their own section
 * never overwrites the facility's other edits (or other providers).
 */
export async function upsertProviderInDraft(clientId, providerKey, providerData) {
  await ensureDraftRow(clientId);
  return withTransaction(async (tx) => {
    const rows = await tx(
      "SELECT data_enc FROM onboarding_drafts WHERE client_id = :c FOR UPDATE",
      { c: clientId }
    );
    const current = decodeData(rows[0]?.data_enc);
    const providers = Array.isArray(current.providers) ? [...current.providers] : [];
    const idx = providers.findIndex((p) => p.key === providerKey);
    const merged = { ...(idx >= 0 ? providers[idx] : {}), ...(providerData || {}), key: providerKey };
    if (idx >= 0) providers[idx] = merged;
    else providers.push(merged);
    const enc = encodeGuarded({ ...current, providers });
    await tx(
      `UPDATE onboarding_drafts
          SET data_enc = :enc,
              status = IF(status = 'approved', 'approved', 'in_progress'),
              updated_at = CURRENT_TIMESTAMP
        WHERE client_id = :c`,
      { enc, c: clientId }
    );
    return { ok: true };
  });
}

/** Upsert a client's draft. `data` is the whole wizard state object. */
export async function saveDraft(clientId, { data, current_step }) {
  const jsonStr = JSON.stringify(data ?? {});
  if (Buffer.byteLength(jsonStr, "utf8") > MAX_DRAFT_BYTES) {
    const err = new Error("Draft is too large to save.");
    err.code = "DRAFT_TOO_LARGE";
    throw err;
  }
  const enc = encrypt(jsonStr);
  // Clamp the step into the real range so a bad value can't wedge the wizard.
  const n = Number(current_step);
  const step = Number.isInteger(n) ? Math.min(Math.max(n, 1), TOTAL_STEPS) : 1;
  await query(
    `INSERT INTO onboarding_drafts (client_id, current_step, data_enc, status)
       VALUES (:clientId, :step, :enc, 'in_progress')
     ON DUPLICATE KEY UPDATE
       data_enc = VALUES(data_enc),
       current_step = VALUES(current_step),
       -- Editing after a submission drops it back to in-progress until re-approved.
       status = IF(status = 'approved', 'approved', 'in_progress'),
       updated_at = CURRENT_TIMESTAMP`,
    { clientId, step, enc }
  );
  const [row] = await query(
    "SELECT updated_at FROM onboarding_drafts WHERE client_id = :clientId LIMIT 1",
    { clientId }
  );
  return { updated_at: row?.updated_at ?? null };
}

/**
 * A document's S3 key must live under this client's own prefix — the guard that
 * stops a confirmed upload from pointing at another client's object. Uses the
 * id-based prefix so it is collision-proof across clients.
 */
export function keyBelongsToClient(key, clientId, clientCode) {
  return typeof key === "string" && key.startsWith(clientPrefix(clientId, clientCode));
}

/**
 * Stricter guard for a PROVIDER document: the key must be under this client AND
 * under this specific provider's folder (keyed by the token-controlled
 * provider_key). Stops one provider from confirming a key in another provider's
 * space, even within the same facility.
 */
export function keyBelongsToProvider(key, clientId, clientCode, providerKey) {
  if (!keyBelongsToClient(key, clientId, clientCode)) return false;
  const seg = slugify(providerKey, "provider");
  return key.includes(`/providers/${seg}/documents/`);
}

/** Insert a document row after its object has been confirmed present in S3. */
export async function insertDocument({
  clientId,
  scope,
  providerKey = null,
  category,
  docType,
  key,
  filename,
  size,
  contentType,
  uploadedBy = null,
}) {
  const result = await query(
    `INSERT INTO onboarding_documents
       (client_id, scope, provider_key, category, doc_type, s3_bucket, s3_key,
        filename, size_bytes, content_type, uploaded_by)
     VALUES
       (:clientId, :scope, :providerKey, :category, :docType, :bucket, :key,
        :filename, :size, :contentType, :uploadedBy)`,
    {
      clientId,
      scope: scope === "provider" ? "provider" : "facility",
      providerKey,
      category,
      docType,
      bucket: bucket(),
      key,
      filename,
      size: Number(size) || 0,
      contentType: contentType || null,
      uploadedBy,
    }
  );
  return {
    id: result.insertId,
    scope: scope === "provider" ? "provider" : "facility",
    provider_key: providerKey,
    category,
    doc_type: docType,
    filename,
    size_bytes: Number(size) || 0,
    content_type: contentType || null,
    created_at: new Date().toISOString(),
  };
}

/** Every uploaded document for a client, shaped for the UI (no S3 secrets). */
export async function listDocuments(clientId) {
  const rows = await query(
    `SELECT id, scope, provider_key, category, doc_type, filename, size_bytes,
            content_type, created_at
       FROM onboarding_documents
      WHERE client_id = :clientId
      ORDER BY created_at ASC`,
    { clientId }
  );
  return rows.map((d) => ({
    id: d.id,
    scope: d.scope,
    provider_key: d.provider_key,
    category: d.category,
    doc_type: d.doc_type,
    filename: d.filename,
    size_bytes: Number(d.size_bytes) || 0,
    content_type: d.content_type,
    created_at: d.created_at,
  }));
}

/** A 16-digit numeric reference, unique across all submissions. */
async function generateUniqueReference() {
  for (let attempt = 0; attempt < 8; attempt++) {
    // 16 digits: two 8-digit halves so it never overflows Number and never has
    // a leading zero stripped.
    const a = String(crypto.randomInt(10000000, 100000000));
    const b = String(crypto.randomInt(10000000, 100000000));
    const ref = a + b;
    const dupe = await query(
      "SELECT 1 FROM onboarding_submissions WHERE reference_code = :ref LIMIT 1",
      { ref }
    );
    if (!dupe.length) return ref;
  }
  throw new Error("Could not allocate a unique reference. Please try again.");
}

/**
 * Finalize a client's onboarding: allocate the unique 16-digit reference, write
 * the immutable submission snapshot, and flip the draft to 'approved'. Idempotent
 * per client — an already-approved client keeps its existing reference.
 */
export async function approveOnboarding(clientId, { approvedBy, approvedEmail }) {
  const existing = await query(
    "SELECT reference_code, status FROM onboarding_drafts WHERE client_id = :clientId LIMIT 1",
    { clientId }
  );
  if (existing.length && existing[0].status === "approved" && existing[0].reference_code) {
    return { reference_code: existing[0].reference_code, alreadyApproved: true };
  }

  const draft = await loadDraft(clientId);
  const documents = await listDocuments(clientId);
  const reference = await generateUniqueReference();

  const snapshot = encrypt(
    JSON.stringify({ data: draft.data, documents, approvedAt: new Date().toISOString() })
  );

  await query(
    `INSERT INTO onboarding_submissions
       (client_id, reference_code, snapshot_enc, approved_by, approved_email)
     VALUES (:clientId, :reference, :snapshot, :approvedBy, :approvedEmail)`,
    { clientId, reference, snapshot, approvedBy: approvedBy ?? null, approvedEmail: approvedEmail ?? null }
  );

  await query(
    `UPDATE onboarding_drafts
        SET status = 'approved', reference_code = :reference,
            submitted_at = COALESCE(submitted_at, CURRENT_TIMESTAMP),
            approved_at = CURRENT_TIMESTAMP
      WHERE client_id = :clientId`,
    { clientId, reference }
  );

  await writeAudit({
    actorId: approvedBy ?? null,
    actorEmail: approvedEmail ?? null,
    action: "onboarding_approved",
    entity: "onboarding",
    entityId: clientId,
    meta: { reference },
  });

  return { reference_code: reference, alreadyApproved: false };
}
