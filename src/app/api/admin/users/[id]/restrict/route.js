import { query, writeAudit } from "@/lib/db.js";
import { requireApi, json, clientIp, invalidateUserStatus } from "@/lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/users/:id/restrict  Body: { restricted: boolean }
// Restricting a user blocks new logins and rejects their existing sessions:
// requireApi checks is_restricted on every request. That check is cached per
// instance for a few seconds, so an instance other than the one serving this
// change can keep honouring a session until its cached entry expires.
export async function POST(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid user id." }, 400);

  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const restricted = body?.restricted ? 1 : 0;

  const target = await query("SELECT role FROM users WHERE id = :id LIMIT 1", { id });
  if (!target.length) return json({ error: "User not found." }, 404);
  if (target[0].role === "super_admin") {
    return json({ error: "Super admin accounts cannot be restricted." }, 403);
  }

  await query("UPDATE users SET is_restricted = :restricted WHERE id = :id", { restricted, id });
  // This instance must honour the change on the very next request, not after
  // its cached copy of the old value expires.
  invalidateUserStatus(id);

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: restricted ? "user_restricted" : "user_unrestricted",
    entity: "user",
    entityId: id,
    ip: clientIp(req),
  });

  return json({ ok: true, is_restricted: !!restricted });
}
