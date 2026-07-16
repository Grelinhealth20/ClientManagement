import { requireClientApi, json } from "@/lib/auth.js";
import { getTicket, addTicketResponse } from "@/lib/requests.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/client/tickets/:ticketId/responses — a client user adds a comment to
// their own ticket. Ownership is enforced by client_id.
export async function POST(req, { params }) {
  const guard = await requireClientApi("dashboard");
  if (guard.error) return guard.error;
  const ticketId = Number(params.ticketId);
  if (!Number.isInteger(ticketId)) return json({ error: "Invalid ticket id." }, 400);

  const ticket = await getTicket(ticketId);
  if (!ticket || ticket.client_id !== guard.clientId) return json({ error: "Ticket not found." }, 404);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (!String(body?.message || "").trim()) return json({ error: "A message is required." }, 400);

  const id = await addTicketResponse(ticketId, {
    authorType: "client_user",
    authorId: guard.session.sub,
    authorName: guard.session.name || guard.session.email,
    message: body.message,
  });
  return json({ ok: true, id });
}
