import { requireApi, json, clientIp } from "@/lib/auth.js";
import { query, writeAudit } from "@/lib/db.js";
import { loadDraft, patchDraft, listDocuments } from "@/lib/onboarding.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/clients/:id/onboarding — the client's full onboarding: the
// decrypted 4-step draft, its documents, users, and (if approved) reference.
export async function GET(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid client id." }, 400);

  const [clientRows, draft, documents, users] = await Promise.all([
    query(
      `SELECT id, client_code, name, company, email, specialty, status, onboarding_status
         FROM clients WHERE id = :id LIMIT 1`,
      { id }
    ),
    loadDraft(id),
    listDocuments(id),
    query(
      `SELECT id, name, email, permissions, is_restricted, must_reset_password, last_login_at, created_at
         FROM users WHERE client_id = :id AND role = 'client_user' ORDER BY created_at ASC`,
      { id }
    ),
  ]);
  if (!clientRows.length) return json({ error: "Client not found." }, 404);

  return json({
    client: clientRows[0],
    draft: {
      data: draft.data,
      status: draft.status,
      reference_code: draft.reference_code,
      updated_at: draft.updated_at,
    },
    documents,
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.email,
      permissions: safeJson(u.permissions, []),
      is_restricted: !!u.is_restricted,
      must_reset_password: !!u.must_reset_password,
      last_login_at: u.last_login_at,
      created_at: u.created_at,
    })),
  });
}

// PUT /api/admin/clients/:id/onboarding — merge a patch into the client's draft
// (used by the admin detail view to edit payer portals / system access in real
// time). Only the top-level sections present in `patch` are replaced.
export async function PUT(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid client id." }, 400);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const patch = body?.patch && typeof body.patch === "object" ? body.patch : null;
  if (!patch) return json({ error: "Nothing to update." }, 400);

  const clientRows = await query("SELECT id FROM clients WHERE id = :id LIMIT 1", { id });
  if (!clientRows.length) return json({ error: "Client not found." }, 404);

  const { updated_at } = await patchDraft(id, { patch });

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "onboarding_edited_by_admin",
    entity: "onboarding",
    entityId: id,
    meta: { sections: Object.keys(patch) },
    ip: clientIp(req),
  });

  return json({ ok: true, updated_at });
}

function safeJson(v, fallback) {
  if (v == null) return fallback;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}
