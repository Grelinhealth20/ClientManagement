import { query, writeAudit } from "@/lib/db.js";
import { sanitizePermissions } from "@/lib/permissions.js";
import { requireApi, json, clientIp } from "@/lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUT /api/admin/users/:id/access  Body: { permissions: string[] }
// Dashboard Access Controls — grant/revoke access to specific client-dashboard sections.
export async function PUT(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid user id." }, 400);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const target = await query("SELECT role FROM users WHERE id = :id LIMIT 1", { id });
  if (!target.length) return json({ error: "User not found." }, 404);
  if (target[0].role === "super_admin") {
    return json({ error: "Super admin access cannot be modified here." }, 403);
  }

  const permissions = sanitizePermissions(body?.permissions);
  await query("UPDATE users SET permissions = :permissions WHERE id = :id", {
    permissions: JSON.stringify(permissions),
    id,
  });

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "user_access_updated",
    entity: "user",
    entityId: id,
    meta: { permissions },
    ip: clientIp(req),
  });

  return json({ ok: true, permissions });
}
