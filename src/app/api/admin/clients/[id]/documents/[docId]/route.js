import { requireApi, json } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { presignGetUrl } from "@/lib/s3.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/clients/:id/documents/:docId — presigned view/download URL for
// one of the client's documents (admin can view/download any client's files).
export async function GET(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;

  const id = Number(params.id);
  const docId = Number(params.docId);
  if (!Number.isInteger(id) || !Number.isInteger(docId)) {
    return json({ error: "Invalid id." }, 400);
  }

  const rows = await query(
    "SELECT s3_key, filename FROM onboarding_documents WHERE id = :docId AND client_id = :id LIMIT 1",
    { docId, id }
  );
  if (!rows.length) return json({ error: "Document not found." }, 404);

  const { searchParams } = new URL(req.url);
  const download = searchParams.get("download") === "1";
  const url = await presignGetUrl(rows[0].s3_key, { filename: rows[0].filename, download });
  return json({ url });
}
