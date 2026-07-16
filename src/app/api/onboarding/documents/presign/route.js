import { requireClientApi, json } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { loadDraft } from "@/lib/onboarding.js";
import { buildDocumentKey, presignPutUrl } from "@/lib/s3.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB per document

// POST /api/onboarding/documents/presign — get a presigned URL to upload one
// document straight to S3 from the browser (bypasses the serverless body limit).
export async function POST(req) {
  const guard = await requireClientApi("onboarding");
  if (guard.error) return guard.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const scope = body?.scope === "provider" ? "provider" : "facility";
  const category = String(body?.category || "documents").trim();
  const docType = String(body?.doc_type || "Document").trim();
  const providerKey = body?.provider_key ? String(body.provider_key).trim() : null;
  const providerName = body?.provider_name ? String(body.provider_name).trim() : null;
  const filename = String(body?.filename || "file").trim();
  const contentType = body?.content_type ? String(body.content_type) : "application/octet-stream";
  const size = Number(body?.size) || 0;

  if (size > MAX_BYTES) return json({ error: "File exceeds the 25 MB limit." }, 413);
  if (scope === "provider" && !providerKey) {
    return json({ error: "A provider must be selected for provider documents." }, 400);
  }

  const [clientRow] = await query("SELECT client_code FROM clients WHERE id = :id LIMIT 1", {
    id: guard.clientId,
  });
  if (!clientRow) return json({ error: "Client not found." }, 404);

  const draft = await loadDraft(guard.clientId);
  const facilityName = draft?.data?.facility?.facilityName || clientRow.client_code;

  const key = buildDocumentKey({
    clientId: guard.clientId,
    clientCode: clientRow.client_code,
    facilityName,
    providerKey,
    scope,
    category,
    filename,
  });

  const { url, headers } = await presignPutUrl({ key, contentType });
  return json({ ok: true, url, headers, key });
}
