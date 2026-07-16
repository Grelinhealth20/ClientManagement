import { requireApi, json, clientIp } from "@/lib/auth.js";
import { query, writeAudit } from "@/lib/db.js";
import { reopenChecklist, deleteChecklist } from "@/lib/requests.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownerClient(requestId) {
  const rows = await query(
    `SELECT r.client_id, c.client_code FROM checklist_requests r
       JOIN clients c ON c.id = r.client_id WHERE r.id = :requestId LIMIT 1`,
    { requestId }
  );
  return rows[0] || null;
}

// PATCH /api/admin/checklists/:requestId — reopen a completed checklist and
// route it back to the client (all items reset to pending).
export async function PATCH(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;
  const requestId = Number(params.requestId);
  if (!Number.isInteger(requestId)) return json({ error: "Invalid request id." }, 400);

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (body?.action !== "reopen") return json({ error: "Unsupported action." }, 400);

  const owner = await ownerClient(requestId);
  if (!owner) return json({ error: "Checklist not found." }, 404);
  const ok = await reopenChecklist(requestId, owner.client_id);
  if (!ok) return json({ error: "Checklist not found." }, 404);

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "checklist_request_reopened",
    entity: "client",
    entityId: owner.client_id,
    meta: { client_code: owner.client_code, request_id: requestId },
    ip: clientIp(req),
  });
  return json({ ok: true });
}

// DELETE /api/admin/checklists/:requestId — remove a checklist entirely.
export async function DELETE(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;
  const requestId = Number(params.requestId);
  if (!Number.isInteger(requestId)) return json({ error: "Invalid request id." }, 400);
  const owner = await ownerClient(requestId);
  if (!owner) return json({ error: "Checklist not found." }, 404);
  await deleteChecklist(requestId, owner.client_id);
  return json({ ok: true });
}
