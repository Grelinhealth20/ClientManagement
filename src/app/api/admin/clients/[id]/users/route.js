import { query, writeAudit } from "@/lib/db.js";
import { hashPassword } from "@/lib/crypto.js";
import { requireApi, json, clientIp } from "@/lib/auth.js";
import { sanitizePermissions } from "@/lib/permissions.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Usernames are typed at the login form and stored in users.email. They are
// unique per client (see migrateUsernameScope), so the same username may exist
// under several clients. '@' stays allowed so an email may still be used.
// Kept identical to the create-client route so a username accepted when the
// client was created is also accepted when adding one later.
const USERNAME_RE = /^[A-Za-z0-9._@-]{2,191}$/;

/** Load the client row, or null. Every handler here is scoped to one client. */
async function findClient(id) {
  const rows = await query("SELECT id, client_code FROM clients WHERE id = :id LIMIT 1", { id });
  return rows[0] || null;
}

function shapeUser(u) {
  return {
    id: u.id,
    client_id: u.client_id,
    name: u.name,
    username: u.email,
    permissions: safeJson(u.permissions, []),
    is_restricted: !!u.is_restricted,
    must_reset_password: !!u.must_reset_password,
    last_login_at: u.last_login_at,
    created_at: u.created_at,
  };
}

// GET /api/admin/clients/:id/users — list the users provisioned for this client.
export async function GET(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid client id." }, 400);

  const client = await findClient(id);
  if (!client) return json({ error: "Client not found." }, 404);

  const rows = await query(
    `SELECT id, client_id, name, email, permissions, is_restricted,
            must_reset_password, last_login_at, created_at
       FROM users
      WHERE client_id = :id AND role = 'client_user'
      ORDER BY created_at ASC`,
    { id }
  );
  return json({ users: rows.map(shapeUser) });
}

// POST /api/admin/clients/:id/users — add a user to this client.
//
// Mirrors the user-provisioning rules of the create-client route (username
// format, per-client uniqueness, forced first-login password reset) so the two
// paths can never disagree on what a valid user is.
export async function POST(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid client id." }, 400);

  const client = await findClient(id);
  if (!client) return json({ error: "Client not found." }, 404);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const username = String(body?.username || "").trim().toLowerCase();
  const name = body?.name ? String(body.name).trim() : "";
  const password = body?.password ? String(body.password) : "";
  const permissions = sanitizePermissions(body?.permissions);

  if (!username) return json({ error: "A username is required." }, 400);
  if (!USERNAME_RE.test(username)) {
    return json(
      {
        error: `Username "${username}" may only contain letters, numbers, dots, hyphens, underscores and @.`,
      },
      400
    );
  }
  if (!password) return json({ error: "A temporary password is required." }, 400);
  if (password.length < 8) {
    return json({ error: "The temporary password must be at least 8 characters." }, 400);
  }
  if (!permissions.length) {
    return json({ error: "Select at least one access control." }, 400);
  }

  // Usernames are unique per client, so the duplicate check is scoped to this
  // client rather than global.
  const dup = await query(
    "SELECT id FROM users WHERE client_id = :id AND email = :username LIMIT 1",
    { id, username }
  );
  if (dup.length) {
    return json({ error: `Username "${username}" is already used for this client.` }, 409);
  }

  const password_hash = await hashPassword(password);

  let result;
  try {
    result = await query(
      `INSERT INTO users
         (client_id, name, email, password_hash, role, permissions, is_restricted, must_reset_password)
       VALUES
         (:id, :name, :username, :password_hash, 'client_user', :permissions, 0, 1)`,
      {
        id,
        name: name || username,
        username,
        password_hash,
        permissions: JSON.stringify(permissions),
      }
    );
  } catch (err) {
    // A racing add can still collide on the per-client unique key.
    if (err?.code === "ER_DUP_ENTRY") {
      return json({ error: `Username "${username}" is already used for this client.` }, 409);
    }
    throw err;
  }

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "user_created",
    entity: "user",
    entityId: result.insertId,
    meta: { client_code: client.client_code, username, permissions },
    ip: clientIp(req),
  });

  return json({ ok: true, id: result.insertId }, 201);
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
