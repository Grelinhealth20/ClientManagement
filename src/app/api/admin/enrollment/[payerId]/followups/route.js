import { requireApi, json } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { addFollowup } from "@/lib/requests.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/enrollment/:payerId/followups — add a timestamped follow-up.
export async function POST(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;
  const payerId = Number(params.payerId);
  if (!Number.isInteger(payerId)) return json({ error: "Invalid payer id." }, 400);

  const rows = await query("SELECT client_id FROM enrollment_payers WHERE id = :payerId LIMIT 1", { payerId });
  const clientId = rows[0]?.client_id ?? null;
  if (!clientId) return json({ error: "Payer not found." }, 404);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (!String(body?.note || "").trim()) return json({ error: "A note is required." }, 400);

  const id = await addFollowup(payerId, clientId, {
    note: body.note,
    createdBy: guard.session.sub,
    createdEmail: guard.session.email,
  });
  if (!id) return json({ error: "Payer not found." }, 404);
  return json({ ok: true, id });
}
