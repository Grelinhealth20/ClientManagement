import { requireApi, json } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { listEnrollment, createPayer } from "@/lib/requests.js";
import { ENROLLMENT_SCOPE } from "@/lib/requestsDomain.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/clients/:id/enrollment?scope=facility|provider — payers + notes.
export async function GET(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid client id." }, 400);
  const scope = new URL(req.url).searchParams.get("scope");
  const filter = ENROLLMENT_SCOPE.includes(scope) ? scope : null;
  return json({ payers: await listEnrollment(id, filter) });
}

// POST /api/admin/clients/:id/enrollment — add a payer to facility or a provider.
export async function POST(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid client id." }, 400);
  const [client] = await query("SELECT id FROM clients WHERE id = :id LIMIT 1", { id });
  if (!client) return json({ error: "Client not found." }, 404);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (!ENROLLMENT_SCOPE.includes(body?.scope)) return json({ error: "Invalid scope." }, 400);
  if (!String(body?.payer_name || "").trim()) return json({ error: "Payer name is required." }, 400);
  if (body.scope === "provider" && !String(body?.provider_name || "").trim()) {
    return json({ error: "Provider name is required for a provider payer." }, 400);
  }

  const payerId = await createPayer(id, {
    scope: body.scope,
    provider_key: body.provider_key,
    provider_name: body.provider_name,
    payer_name: body.payer_name,
    status: body.status,
    start_date: body.start_date,
    notes: body.notes,
    created_by: guard.session.sub,
  });
  return json({ ok: true, id: payerId });
}
