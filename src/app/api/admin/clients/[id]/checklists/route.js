import { requireApi, json, clientIp } from "@/lib/auth.js";
import { query, writeAudit } from "@/lib/db.js";
import { createChecklist, listChecklists } from "@/lib/requests.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function clientExists(id) {
  const rows = await query("SELECT id, client_code, name FROM clients WHERE id = :id LIMIT 1", { id });
  return rows[0] || null;
}

// GET /api/admin/clients/:id/checklists — every checklist request for the client.
export async function GET(_req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid client id." }, 400);
  if (!(await clientExists(id))) return json({ error: "Client not found." }, 404);
  return json({ checklists: await listChecklists(id) });
}

// POST /api/admin/clients/:id/checklists — create a checklist request + items.
export async function POST(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid client id." }, 400);
  const client = await clientExists(id);
  if (!client) return json({ error: "Client not found." }, 404);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  let requestId;
  try {
    requestId = await createChecklist(id, {
      title: body?.title,
      message: body?.message,
      items: body?.items,
      createdBy: guard.session.sub,
      createdEmail: guard.session.email,
    });
  } catch (e) {
    return json({ error: e.message || "Could not create the checklist." }, 400);
  }

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "checklist_request_sent",
    entity: "client",
    entityId: id,
    meta: { client_code: client.client_code, title: body?.title },
    ip: clientIp(req),
  });

  return json({ ok: true, id: requestId });
}
