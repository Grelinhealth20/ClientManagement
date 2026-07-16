import { json } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { loadDraft } from "@/lib/onboarding.js";
import { resolveLink, isLinkActive, verifyCredential } from "@/lib/providerLinks.js";
import { buildDocumentKey, putObject, presignGetUrl, deleteObject, bucket } from "@/lib/s3.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

async function authorizeForm(token, form) {
  const link = await resolveLink(token);
  if (!link) return { error: json({ error: "This link is not valid." }, 404) };
  if (!isLinkActive(link)) return { error: json({ error: "This link has expired or was revoked." }, 410) };
  if (!verifyCredential(link, form.get("credential") || form.get("key"))) return { error: json({ error: "Incorrect security key or NPI." }, 401) };
  return { link, providerKey: link.provider_key || `link-${link.id}` };
}

// GET /api/provider-intake/:token/documents?key=... — list this provider's docs.
export async function GET(req, { params }) {
  const { searchParams } = new URL(req.url);
  const link = await resolveLink(params.token);
  if (!link) return json({ error: "This link is not valid." }, 404);
  if (!isLinkActive(link)) return json({ error: "This link has expired or was revoked." }, 410);
  if (!verifyCredential(link, searchParams.get("credential") || searchParams.get("key"))) return json({ error: "Incorrect security key or NPI." }, 401);

  const key = link.provider_key || `link-${link.id}`;
  const rows = await query(
    `SELECT id, doc_type, category, filename, size_bytes, content_type, created_at
       FROM onboarding_documents
      WHERE client_id = :clientId AND scope = 'provider' AND provider_key = :pk
      ORDER BY created_at ASC`,
    { clientId: link.client_id, pk: key }
  );
  return json({ documents: rows.map((d) => ({ ...d, size_bytes: Number(d.size_bytes) || 0 })) });
}

// POST /api/provider-intake/:token/documents — external provider uploads a doc
// into their subfolder under the facility.
export async function POST(req, { params }) {
  let form;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Expected a multipart form upload." }, 400);
  }

  const auth = await authorizeForm(params.token, form);
  if (auth.error) return auth.error;
  const { link, providerKey } = auth;

  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return json({ error: "No file was provided." }, 400);
  }
  if (file.size > MAX_BYTES) return json({ error: "File exceeds the 25 MB limit." }, 413);

  const docType = String(form.get("doc_type") || file.name || "Document").trim();
  const category = String(form.get("category") || "provider").trim();
  const providerName = form.get("provider_name") ? String(form.get("provider_name")).trim() : null;

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
    filename: file.name,
  });

  const buf = Buffer.from(await file.arrayBuffer());
  await putObject({ key, body: buf, contentType: file.type });

  const result = await query(
    `INSERT INTO onboarding_documents
       (client_id, scope, provider_key, category, doc_type, s3_bucket, s3_key,
        filename, size_bytes, content_type)
     VALUES
       (:clientId, 'provider', :pk, :category, :docType, :bucket, :key,
        :filename, :size, :contentType)`,
    {
      clientId: link.client_id,
      pk: providerKey,
      category,
      docType,
      bucket: bucket(),
      key,
      filename: file.name,
      size: file.size,
      contentType: file.type || null,
    }
  );

  return json(
    {
      ok: true,
      document: {
        id: result.insertId,
        doc_type: docType,
        category,
        filename: file.name,
        size_bytes: file.size,
        content_type: file.type || null,
        created_at: new Date().toISOString(),
      },
    },
    201
  );
}
