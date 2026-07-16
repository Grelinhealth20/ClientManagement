import { json } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { insertDocument, keyBelongsToProvider } from "@/lib/onboarding.js";
import { resolveLink, isLinkActive, verifyCredential } from "@/lib/providerLinks.js";
import { headObject } from "@/lib/s3.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/provider-intake/:token/documents/confirm — record a document after
// the external provider's presigned upload completes.
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

  const key = String(body?.key || "");
  const category = String(body?.category || "provider").trim();
  const docType = String(body?.doc_type || "Document").trim();
  const filename = String(body?.filename || "file").trim();
  const contentType = body?.content_type ? String(body.content_type) : null;
  const providerKey = link.provider_key || `link-${link.id}`;

  const [clientRow] = await query("SELECT client_code FROM clients WHERE id = :id LIMIT 1", {
    id: link.client_id,
  });
  // Must be under THIS provider's folder — a provider can never confirm a key
  // belonging to another provider (even within the same facility).
  if (!keyBelongsToProvider(key, link.client_id, clientRow?.client_code, providerKey)) {
    return json({ error: "Invalid upload reference." }, 400);
  }

  const meta = await headObject(key);
  if (!meta) return json({ error: "Upload was not completed. Please try again." }, 400);

  const document = await insertDocument({
    clientId: link.client_id,
    scope: "provider",
    providerKey,
    category,
    docType,
    key,
    filename,
    size: meta.size,
    contentType: contentType || meta.contentType,
  });

  return json({ ok: true, document }, 201);
}
