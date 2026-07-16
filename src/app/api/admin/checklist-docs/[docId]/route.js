import { requireApi, json } from "@/lib/auth.js";
import { presignGetUrl, deleteObject } from "@/lib/s3.js";
import { getChecklistDocument, deleteChecklistDocument } from "@/lib/requests.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/checklist-docs/:docId — a short-lived URL to view/download the
// document (admin can open both admin-attached and client-submitted files).
export async function GET(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;
  const docId = Number(params.docId);
  if (!Number.isInteger(docId)) return json({ error: "Invalid document id." }, 400);
  const doc = await getChecklistDocument(docId);
  if (!doc) return json({ error: "Document not found." }, 404);
  const download = new URL(req.url).searchParams.get("download") === "1";
  const url = await presignGetUrl(doc.s3_key, { filename: doc.filename, download });
  return json({ ok: true, url });
}

// DELETE /api/admin/checklist-docs/:docId — remove an admin-attached document.
export async function DELETE(_req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;
  const docId = Number(params.docId);
  if (!Number.isInteger(docId)) return json({ error: "Invalid document id." }, 400);
  const doc = await getChecklistDocument(docId);
  if (!doc) return json({ error: "Document not found." }, 404);
  if (doc.source !== "admin") return json({ error: "Only admin-attached files can be removed here." }, 403);
  try {
    await deleteObject(doc.s3_key);
  } catch {
    // storage delete best-effort; DB row is the source of truth for the UI
  }
  await deleteChecklistDocument(docId);
  return json({ ok: true });
}
