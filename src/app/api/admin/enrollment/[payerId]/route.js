import { requireApi, json } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { updatePayer, deletePayer } from "@/lib/requests.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownerClientId(payerId) {
  const rows = await query("SELECT client_id FROM enrollment_payers WHERE id = :payerId LIMIT 1", { payerId });
  return rows[0]?.client_id ?? null;
}

// PATCH /api/admin/enrollment/:payerId — update status / start date / notes.
export async function PATCH(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;
  const payerId = Number(params.payerId);
  if (!Number.isInteger(payerId)) return json({ error: "Invalid payer id." }, 400);
  const clientId = await ownerClientId(payerId);
  if (!clientId) return json({ error: "Payer not found." }, 404);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (!String(body?.payer_name || "").trim()) return json({ error: "Payer name is required." }, 400);

  const ok = await updatePayer(payerId, clientId, {
    payer_name: body.payer_name,
    status: body.status,
    start_date: body.start_date,
    notes: body.notes,
    provider_name: body.provider_name,
  });
  if (!ok) return json({ error: "Payer not found." }, 404);
  return json({ ok: true });
}

// DELETE /api/admin/enrollment/:payerId — remove a payer row.
export async function DELETE(_req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;
  const payerId = Number(params.payerId);
  if (!Number.isInteger(payerId)) return json({ error: "Invalid payer id." }, 400);
  const clientId = await ownerClientId(payerId);
  if (!clientId) return json({ error: "Payer not found." }, 404);
  await deletePayer(payerId, clientId);
  return json({ ok: true });
}
