import { requireApi, json } from "@/lib/auth.js";
import { listTickets } from "@/lib/requests.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/clients/:id/tickets — every request-from-client ticket.
export async function GET(_req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid client id." }, 400);
  return json({ tickets: await listTickets(id) });
}
