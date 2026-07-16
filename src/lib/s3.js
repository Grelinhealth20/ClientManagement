import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { s3Config } from "./env.js";

// ─────────────────────────────────────────────────────────────
// S3 object storage for onboarding documents.
//
// Folder layout (keys), so a client's facility and its providers each get a
// clearly named home and nothing collides across clients:
//
//   clients/<clientCode>/facilities/<facilitySlug>/documents/<category>/<file>
//   clients/<clientCode>/facilities/<facilitySlug>/providers/<providerSlug>/documents/<category>/<file>
//
// The client code and facility/provider names are slugged for S3-safe keys; the
// human names are preserved in the DB row alongside the key.
// ─────────────────────────────────────────────────────────────

const globalForS3 = globalThis;

export function getS3() {
  if (!globalForS3.__grelinS3) {
    const cfg = s3Config();
    globalForS3.__grelinS3 = new S3Client({
      region: cfg.region,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }
  return globalForS3.__grelinS3;
}

export function bucket() {
  return s3Config().bucket;
}

/** Lowercase, hyphenated, filesystem/S3-safe slug. Never empty; length-capped
 *  so a pathological name can't blow past S3's key limit or the DB column. */
export function slugify(input, fallback = "unnamed") {
  const s = String(input || "")
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80)
    .replace(/-+$/g, "");
  return s || fallback;
}

/** Keep an original filename readable but safe, and always unique via a prefix. */
export function safeFilename(name) {
  const cleaned = String(name || "file")
    .replace(/[^\w.\- ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
  return cleaned || "file";
}

/**
 * The per-client top-level folder segment. Prefixed with the immutable, unique
 * client_id so two different client codes can NEVER collide into the same S3
 * space (e.g. "Acme_1" and "Acme-1" both slugify to "acme-1"; their integer ids
 * keep them separate). The code slug is appended only for human readability.
 */
export function clientSegment(clientId, clientCode) {
  const idPart = String(clientId ?? "").replace(/[^0-9]/g, "") || "0";
  return `${idPart}-${slugify(clientCode, "client")}`;
}

/** The isolation boundary: every one of a client's objects lives under this. */
export function clientPrefix(clientId, clientCode) {
  return `clients/${clientSegment(clientId, clientCode)}/`;
}

export function facilityPrefix(clientId, clientCode, facilityName) {
  return `clients/${clientSegment(clientId, clientCode)}/facilities/${slugify(
    facilityName,
    "facility"
  )}`;
}

/**
 * A provider's folder is keyed by the provider_key — unique within the facility
 * and controlled by the invite token — so two providers can NEVER share a folder
 * (a name-based slug could collide, and a provider name is client-supplied).
 */
export function providerPrefix(clientId, clientCode, facilityName, providerKey) {
  return `${facilityPrefix(clientId, clientCode, facilityName)}/providers/${slugify(
    providerKey,
    "provider"
  )}`;
}

/**
 * Build the full object key for a document.
 * scope: "facility" | "provider". Provider docs are keyed by provider_key.
 */
export function buildDocumentKey({
  clientId,
  clientCode,
  facilityName,
  providerKey,
  scope,
  category,
  filename,
}) {
  const base =
    scope === "provider"
      ? providerPrefix(clientId, clientCode, facilityName, providerKey)
      : facilityPrefix(clientId, clientCode, facilityName);
  const cat = slugify(category, "documents");
  const unique = crypto.randomBytes(6).toString("hex");
  return `${base}/documents/${cat}/${unique}-${safeFilename(filename)}`;
}

/** The folder that holds all of a client's checklist documents, nested inside
 *  that client's facility folder so it lives alongside the onboarding docs. */
export function checklistPrefix(clientId, clientCode, facilityName) {
  return `${facilityPrefix(clientId, clientCode, facilityName)}/checklists`;
}

/**
 * Object key for a checklist document — nested under the client's FACILITY
 * folder (so it sits with the rest of that facility's documents), then by
 * request id + source ('admin' download-grant, or 'client' submission) so
 * nothing collides and tenant isolation holds.
 */
export function checklistDocKey({ clientId, clientCode, facilityName, requestId, source, filename }) {
  const src = source === "admin" ? "admin" : "client";
  const unique = crypto.randomBytes(6).toString("hex");
  return `${checklistPrefix(clientId, clientCode, facilityName)}/${requestId}/${src}/${unique}-${safeFilename(filename)}`;
}

export async function putObject({ key, body, contentType }) {
  await getS3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
      ServerSideEncryption: "AES256",
    })
  );
  return key;
}

export async function deleteObject(key) {
  await getS3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/**
 * Ensure a "folder" exists in S3 by writing a zero-byte marker at
 * `<prefix>/.keep` (and `<prefix>/documents/.keep`). S3 has no real folders, so
 * this is what makes the facility/provider folder show up before any document is
 * uploaded into it. Idempotent — re-writing the marker is harmless.
 */
export async function ensureFolder(prefix) {
  const base = prefix.replace(/\/+$/, "");
  await Promise.all([
    putObject({ key: `${base}/.keep`, body: Buffer.from(""), contentType: "application/x-directory" }),
    putObject({ key: `${base}/documents/.keep`, body: Buffer.from(""), contentType: "application/x-directory" }),
  ]);
  return base;
}

/**
 * A short-lived presigned URL for the browser to PUT a file straight to S3,
 * bypassing our server (and Vercel's request-body size limit). The returned
 * headers MUST be sent with the PUT so the signature matches.
 */
export async function presignPutUrl({ key, contentType }) {
  const ct = contentType || "application/octet-stream";
  const cmd = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: ct,
    ServerSideEncryption: "AES256",
  });
  const url = await getSignedUrl(getS3(), cmd, { expiresIn: 300 });
  return { url, headers: { "Content-Type": ct, "x-amz-server-side-encryption": "AES256" } };
}

/** Metadata for an object, or null if it does not exist (upload not completed). */
export async function headObject(key) {
  try {
    const r = await getS3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { size: Number(r.ContentLength) || 0, contentType: r.ContentType || null };
  } catch {
    return null;
  }
}

/**
 * A short-lived presigned URL to view/download an object. The filename is set as
 * a content-disposition so the browser names the download sensibly.
 */
export async function presignGetUrl(key, { filename, download = false, expiresIn = 300 } = {}) {
  const disposition = filename
    ? `${download ? "attachment" : "inline"}; filename="${safeFilename(filename)}"`
    : undefined;
  const cmd = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ResponseContentDisposition: disposition,
  });
  return getSignedUrl(getS3(), cmd, { expiresIn });
}
