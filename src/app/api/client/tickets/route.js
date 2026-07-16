import { requireClientApi, json, clientIp } from "@/lib/auth.js";
import { query, writeAudit } from "@/lib/db.js";
import { listTickets, createTicket } from "@/lib/requests.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/client/tickets — this client's requests + their responses.
export async function GET() {
  const guard = await requireClientApi("dashboard");
  if (guard.error) return guard.error;
  return json({ tickets: await listTickets(guard.clientId) });
}

// POST /api/client/tickets — raise a new request. Allocates a unique ticket id
// and notifies the super admin + master admin in real time.
export async function POST(req) {
  const guard = await requireClientApi("dashboard");
  if (guard.error) return guard.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (!String(body?.subject || "").trim()) return json({ error: "A subject is required." }, 400);

  const { id, ticket_code } = await createTicket(guard.clientId, {
    subject: body.subject,
    categories: body.categories,
    details: body.details,
    createdBy: guard.session.sub,
    createdName: guard.session.name || guard.session.email,
  });

  const [c] = await query("SELECT client_code, name FROM clients WHERE id = :id LIMIT 1", {
    id: guard.clientId,
  });
  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "client_request_raised",
    entity: "client",
    entityId: guard.clientId,
    meta: { client_code: c?.client_code, client_name: c?.name, ticket_code, subject: body.subject },
    ip: clientIp(req),
  });

  return json({ ok: true, id, ticket_code });
}
