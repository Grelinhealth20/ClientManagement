import { query, writeAudit } from "@/lib/db.js";
import { sanitizePermissions } from "@/lib/permissions.js";
import { requireApi, json, clientIp, invalidateUserStatus } from "@/lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Usernames are stored in users.email and are unique per client, so they need
// not be email-format. Kept in step with the create-client route.
const USERNAME_RE = /^[A-Za-z0-9._@-]{2,191}$/;

// PUT /api/admin/users/:id — edit a client user (name, username, permissions)
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

  const target = await query(
    "SELECT id, role, client_id FROM users WHERE id = :id LIMIT 1",
    { id }
  );
  if (!target.length) return json({ error: "User not found." }, 404);
  if (target[0].role === "super_admin") {
    return json({ error: "Super admin accounts cannot be modified here." }, 403);
  }
  const clientId = target[0].client_id;

  const name = String(body?.name || "").trim();
  // Accept `username` or legacy `email`; stored in users.email either way.
  const username = String(body?.username ?? body?.email ?? "").trim().toLowerCase();
  const permissions = sanitizePermissions(body?.permissions);

  if (!name) return json({ error: "User name is required." }, 400);
  if (!username) return json({ error: "A username is required." }, 400);
  if (!USERNAME_RE.test(username)) {
    return json(
      {
        error: `Username "${username}" may only contain letters, numbers, dots, hyphens, underscores and @.`,
      },
      400
    );
  }

  // Usernames are unique per client, so the duplicate check is scoped to the
  // target user's client rather than the whole users table.
  const dup = await query(
    "SELECT id FROM users WHERE client_id <=> :clientId AND email = :username AND id <> :id LIMIT 1",
    { clientId, username, id }
  );
  if (dup.length) {
    return json({ error: `Username "${username}" is already used for this client.` }, 409);
  }

  try {
    await query(
      `UPDATE users SET name = :name, email = :username, permissions = :permissions WHERE id = :id`,
      { name, username, permissions: JSON.stringify(permissions), id }
    );
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY") {
      return json({ error: `Username "${username}" is already used for this client.` }, 409);
    }
    throw err;
  }

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "user_updated",
    entity: "user",
    entityId: id,
    meta: { username, permissions },
    ip: clientIp(req),
  });

  return json({ ok: true });
}

// DELETE /api/admin/users/:id
export async function DELETE(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid user id." }, 400);

  const target = await query("SELECT role FROM users WHERE id = :id LIMIT 1", { id });
  if (!target.length) return json({ error: "User not found." }, 404);
  if (target[0].role === "super_admin") {
    return json({ error: "Super admin accounts cannot be deleted." }, 403);
  }

  await query("DELETE FROM users WHERE id = :id", { id });
  // Stop this instance serving requests against a cached "account exists".
  invalidateUserStatus(id);

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "user_deleted",
    entity: "user",
    entityId: id,
    ip: clientIp(req),
  });

  return json({ ok: true });
}
