import { requireClientApi, json } from "@/lib/auth.js";
import { presignGetUrl, deleteObject } from "@/lib/s3.js";
import { getChecklistDocument, deleteChecklistDocument } from "@/lib/requests.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/client/checklist-docs/:docId — download a document tied to this
// client (an admin-attached file to download, or one the client uploaded).
export async function GET(req, { params }) {
  const guard = await requireClientApi("dashboard");
  if (guard.error) return guard.error;
  const docId = Number(params.docId);
  if (!Number.isInteger(docId)) return json({ error: "Invalid document id." }, 400);
  const doc = await getChecklistDocument(docId);
  if (!doc || doc.client_id !== guard.clientId) return json({ error: "Document not found." }, 404);
  const download = new URL(req.url).searchParams.get("download") === "1";
  const url = await presignGetUrl(doc.s3_key, { filename: doc.filename, download });
  return json({ ok: true, url });
}

// DELETE /api/client/checklist-docs/:docId — remove a file the client uploaded
// (they may not remove admin-attached download files).
export async function DELETE(_req, { params }) {
  const guard = await requireClientApi("dashboard");
  if (guard.error) return guard.error;
  const docId = Number(params.docId);
  if (!Number.isInteger(docId)) return json({ error: "Invalid document id." }, 400);
  const doc = await getChecklistDocument(docId);
  if (!doc || doc.client_id !== guard.clientId) return json({ error: "Document not found." }, 404);
  if (doc.source !== "client") return json({ error: "You can only remove files you uploaded." }, 403);
  try {
    await deleteObject(doc.s3_key);
  } catch {
    // best-effort storage delete
  }
  await deleteChecklistDocument(docId);
  return json({ ok: true });
}
