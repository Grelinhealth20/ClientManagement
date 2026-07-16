import { requireApi, json, clientIp } from "@/lib/auth.js";
import { writeAudit } from "@/lib/db.js";
import { getTicket, updateTicketStatus, addTicketResponse } from "@/lib/requests.js";
import { TICKET_STATUS_VALUES } from "@/lib/requestsDomain.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/admin/tickets/:ticketId — change ticket status and/or post a
// response. A super admin may add multiple responses to the same ticket.
export async function PATCH(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;
  const ticketId = Number(params.ticketId);
  if (!Number.isInteger(ticketId)) return json({ error: "Invalid ticket id." }, 400);

  const ticket = await getTicket(ticketId);
  if (!ticket) return json({ error: "Ticket not found." }, 404);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const message = String(body?.message || "").trim();
  const status = body?.status;
  if (!message && !status) return json({ error: "Nothing to update." }, 400);

  if (message) {
    await addTicketResponse(ticketId, {
      authorType: "super_admin",
      authorId: guard.session.sub,
      authorName: guard.session.name || guard.session.email,
      message,
    });
  }
  if (status) {
    if (!TICKET_STATUS_VALUES.includes(status)) return json({ error: "Invalid status." }, 400);
    await updateTicketStatus(ticketId, ticket.client_id, status);
  }

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "ticket_updated_by_admin",
    entity: "client",
    entityId: ticket.client_id,
    meta: { ticket_code: ticket.ticket_code, status: status || undefined, responded: !!message },
    ip: clientIp(req),
  });
  return json({ ok: true });
}
