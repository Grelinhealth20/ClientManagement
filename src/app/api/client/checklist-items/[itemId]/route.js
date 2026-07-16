import { requireClientApi, json, clientIp } from "@/lib/auth.js";
import { query, writeAudit } from "@/lib/db.js";
import { getChecklistItemContext, setChecklistItemDone } from "@/lib/requests.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/client/checklist-items/:itemId — mark an item complete/incomplete.
// When the whole request completes, notify the super admin + master admin.
export async function POST(req, { params }) {
  const guard = await requireClientApi("dashboard");
  if (guard.error) return guard.error;
  const itemId = Number(params.itemId);
  if (!Number.isInteger(itemId)) return json({ error: "Invalid item id." }, 400);

  const ctx = await getChecklistItemContext(itemId);
  if (!ctx || ctx.client_id !== guard.clientId) return json({ error: "Item not found." }, 404);

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const done = body?.done !== false; // default to marking complete

  const result = await setChecklistItemDone(itemId, done);

  // Real-time notification: an item was completed, and especially when the
  // whole checklist is now done (moves to the completed queue).
  if (done) {
    const [c] = await query("SELECT client_code, name FROM clients WHERE id = :id LIMIT 1", {
      id: guard.clientId,
    });
    await writeAudit({
      actorId: guard.session.sub,
      actorEmail: guard.session.email,
      action: result?.completed ? "checklist_request_completed" : "checklist_item_completed",
      entity: "client",
      entityId: guard.clientId,
      meta: { client_code: c?.client_code, client_name: c?.name, request_id: ctx.request_id },
      ip: clientIp(req),
    });
  }
  return json({ ok: true, completed: !!result?.completed });
}
