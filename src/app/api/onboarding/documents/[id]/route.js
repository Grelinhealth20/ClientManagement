import { requireClientApi, json, clientIp } from "@/lib/auth.js";
import { query, writeAudit } from "@/lib/db.js";
import { presignGetUrl, deleteObject } from "@/lib/s3.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fetch a document row that belongs to this client, or null. */
async function ownDocument(clientId, id) {
  const rows = await query(
    `SELECT id, s3_key, filename FROM onboarding_documents
      WHERE id = :id AND client_id = :clientId LIMIT 1`,
    { id, clientId }
  );
  return rows[0] || null;
}

// GET /api/onboarding/documents/:id — short-lived presigned URL to view/download.
export async function GET(req, { params }) {
  const guard = await requireClientApi("onboarding");
  if (guard.error) return guard.error;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid document id." }, 400);

  const doc = await ownDocument(guard.clientId, id);
  if (!doc) return json({ error: "Document not found." }, 404);

  const { searchParams } = new URL(req.url);
  const download = searchParams.get("download") === "1";
  const url = await presignGetUrl(doc.s3_key, { filename: doc.filename, download });
  return json({ url });
}

// DELETE /api/onboarding/documents/:id — remove from S3 and the manifest.
export async function DELETE(req, { params }) {
  const guard = await requireClientApi("onboarding");
  if (guard.error) return guard.error;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid document id." }, 400);

  const doc = await ownDocument(guard.clientId, id);
  if (!doc) return json({ error: "Document not found." }, 404);

  // Remove the object first; only drop the row once the bytes are gone so we
  // never leave a dangling manifest entry pointing at a deleted object.
  await deleteObject(doc.s3_key);
  await query("DELETE FROM onboarding_documents WHERE id = :id AND client_id = :clientId", {
    id,
    clientId: guard.clientId,
  });

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "onboarding_document_deleted",
    entity: "onboarding_document",
    entityId: id,
    meta: { clientId: guard.clientId },
    ip: clientIp(req),
  });

  return json({ ok: true });
}
