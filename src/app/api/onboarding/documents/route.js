import { requireClientApi, json, clientIp } from "@/lib/auth.js";
import { query, writeAudit } from "@/lib/db.js";
import { loadDraft, listDocuments } from "@/lib/onboarding.js";
import { buildDocumentKey, putObject, bucket } from "@/lib/s3.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB per document

// GET /api/onboarding/documents — list this client's documents.
export async function GET() {
  const guard = await requireClientApi("onboarding");
  if (guard.error) return guard.error;
  return json({ documents: await listDocuments(guard.clientId) });
}

// POST /api/onboarding/documents — upload one document (multipart/form-data).
// Fields: file, scope ("facility"|"provider"), category, doc_type,
//         provider_key?, provider_name?.
export async function POST(req) {
  const guard = await requireClientApi("onboarding");
  if (guard.error) return guard.error;

  let form;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Expected a multipart form upload." }, 400);
  }

  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return json({ error: "No file was provided." }, 400);
  }
  if (file.size > MAX_BYTES) {
    return json({ error: "File exceeds the 25 MB limit." }, 413);
  }

  const scope = form.get("scope") === "provider" ? "provider" : "facility";
  const category = String(form.get("category") || "documents").trim();
  const docType = String(form.get("doc_type") || file.name || "Document").trim();
  const providerKey = form.get("provider_key") ? String(form.get("provider_key")).trim() : null;
  const providerName = form.get("provider_name") ? String(form.get("provider_name")).trim() : null;

  if (scope === "provider" && !providerKey) {
    return json({ error: "A provider must be selected for provider documents." }, 400);
  }

  // The client code and facility name shape the S3 folder path.
  const [clientRow] = await query(
    "SELECT client_code FROM clients WHERE id = :id LIMIT 1",
    { id: guard.clientId }
  );
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
    filename: file.name,
  });

  const buf = Buffer.from(await file.arrayBuffer());
  await putObject({ key, body: buf, contentType: file.type });

  const result = await query(
    `INSERT INTO onboarding_documents
       (client_id, scope, provider_key, category, doc_type, s3_bucket, s3_key,
        filename, size_bytes, content_type, uploaded_by)
     VALUES
       (:clientId, :scope, :providerKey, :category, :docType, :bucket, :key,
        :filename, :size, :contentType, :uploadedBy)`,
    {
      clientId: guard.clientId,
      scope,
      providerKey,
      category,
      docType,
      bucket: bucket(),
      key,
      filename: file.name,
      size: file.size,
      contentType: file.type || null,
      uploadedBy: guard.session.sub,
    }
  );

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "onboarding_document_uploaded",
    entity: "onboarding_document",
    entityId: result.insertId,
    meta: { clientId: guard.clientId, scope, doc_type: docType, provider_key: providerKey },
    ip: clientIp(req),
  });

  return json(
    {
      ok: true,
      document: {
        id: result.insertId,
        scope,
        provider_key: providerKey,
        category,
        doc_type: docType,
        filename: file.name,
        size_bytes: file.size,
        content_type: file.type || null,
        created_at: new Date().toISOString(),
      },
    },
    201
  );
}
