import { requireClientApi, json, clientIp } from "@/lib/auth.js";
import { query, writeAudit } from "@/lib/db.js";
import { insertDocument, keyBelongsToClient, keyBelongsToProvider } from "@/lib/onboarding.js";
import { headObject } from "@/lib/s3.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/onboarding/documents/confirm — after a presigned upload finishes,
// verify the object really exists in S3 and record it. The key is checked to
// belong to this client's own prefix before anything is written.
export async function POST(req) {
  const guard = await requireClientApi("onboarding");
  if (guard.error) return guard.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const key = String(body?.key || "");
  const scope = body?.scope === "provider" ? "provider" : "facility";
  const category = String(body?.category || "documents").trim();
  const docType = String(body?.doc_type || "Document").trim();
  const providerKey = body?.provider_key ? String(body.provider_key).trim() : null;
  const filename = String(body?.filename || "file").trim();
  const contentType = body?.content_type ? String(body.content_type) : null;

  const [clientRow] = await query("SELECT client_code FROM clients WHERE id = :id LIMIT 1", {
    id: guard.clientId,
  });
  if (!clientRow) return json({ error: "Client not found." }, 404);

  if (scope === "provider" && !providerKey) {
    return json({ error: "A provider must be selected for provider documents." }, 400);
  }
  // Provider docs must be under THIS provider's folder; facility docs under the
  // client's. Either way the key can never point outside the caller's own space.
  const keyOk =
    scope === "provider"
      ? keyBelongsToProvider(key, guard.clientId, clientRow.client_code, providerKey)
      : keyBelongsToClient(key, guard.clientId, clientRow.client_code);
  if (!keyOk) {
    return json({ error: "Invalid upload reference." }, 400);
  }

  // Confirm the object actually landed in S3 — and take the size from S3, not
  // from the (untrusted) client.
  const meta = await headObject(key);
  if (!meta) return json({ error: "Upload was not completed. Please try again." }, 400);

  const document = await insertDocument({
    clientId: guard.clientId,
    scope,
    providerKey,
    category,
    docType,
    key,
    filename,
    size: meta.size,
    contentType: contentType || meta.contentType,
    uploadedBy: guard.session.sub,
  });

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "onboarding_document_uploaded",
    entity: "onboarding_document",
    entityId: document.id,
    meta: { clientId: guard.clientId, scope, doc_type: docType, provider_key: providerKey },
    ip: clientIp(req),
  });

  return json({ ok: true, document }, 201);
}
