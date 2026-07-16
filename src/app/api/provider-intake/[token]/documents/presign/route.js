import { json } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { loadDraft } from "@/lib/onboarding.js";
import { resolveLink, isLinkActive, verifyCredential } from "@/lib/providerLinks.js";
import { buildDocumentKey, presignPutUrl } from "@/lib/s3.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

// POST /api/provider-intake/:token/documents/presign — presigned URL for an
// external provider to upload straight to S3 (token + security key gated).
export async function POST(req, { params }) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const link = await resolveLink(params.token);
  if (!link) return json({ error: "This link is not valid." }, 404);
  if (!isLinkActive(link)) return json({ error: "This link has expired or was revoked." }, 410);
  if (!verifyCredential(link, body?.credential ?? body?.securityKey)) return json({ error: "Incorrect security key or NPI." }, 401);

  const size = Number(body?.size) || 0;
  if (size > MAX_BYTES) return json({ error: "File exceeds the 25 MB limit." }, 413);

  const providerKey = link.provider_key || `link-${link.id}`;
  const category = String(body?.category || "provider").trim();
  const filename = String(body?.filename || "file").trim();
  const contentType = body?.content_type ? String(body.content_type) : "application/octet-stream";
  const providerName = body?.provider_name ? String(body.provider_name).trim() : null;

  const [clientRow] = await query("SELECT client_code FROM clients WHERE id = :id LIMIT 1", {
    id: link.client_id,
  });
  const draft = await loadDraft(link.client_id);
  const facilityName = draft?.data?.facility?.facilityName || clientRow?.client_code || "facility";

  const key = buildDocumentKey({
    clientId: link.client_id,
    clientCode: clientRow?.client_code || "client",
    facilityName,
    providerKey,
    scope: "provider",
    category,
    filename,
  });

  const { url, headers } = await presignPutUrl({ key, contentType });
  return json({ ok: true, url, headers, key, provider_key: providerKey });
}
