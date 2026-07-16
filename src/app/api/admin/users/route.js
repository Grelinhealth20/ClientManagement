import { query, writeAudit } from "@/lib/db.js";
import { hashPassword } from "@/lib/crypto.js";
import { sanitizePermissions } from "@/lib/permissions.js";
import { requireApi, json, clientIp } from "@/lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Usernames are stored in users.email and are unique PER CLIENT (see
// migrateUsernameScope in db.js), so they need not be email-format. Kept
// identical to the create-client route so a username accepted there is also
// accepted here. Login is Client ID + Username + Password.
const USERNAME_RE = /^[A-Za-z0-9._@-]{2,191}$/;

// GET /api/admin/users?client_id=optional — list client users
export async function GET(req) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");

  const where = clientId ? "WHERE u.client_id = :clientId" : "WHERE u.role = 'client_user'";
  const rows = await query(
    `SELECT u.id, u.client_id, u.name, u.email, u.role, u.permissions,
            u.is_restricted, u.must_reset_password, u.last_login_at, u.created_at,
            c.name AS client_name
       FROM users u
       LEFT JOIN clients c ON c.id = u.client_id
       ${where} AND u.role = 'client_user'
      ORDER BY u.created_at DESC`,
    clientId ? { clientId: Number(clientId) } : {}
  );

  const users = rows.map((u) => ({
    id: u.id,
    client_id: u.client_id,
    client_name: u.client_name,
    name: u.name,
    email: u.email,
    role: u.role,
    permissions: safeJson(u.permissions, []),
    is_restricted: !!u.is_restricted,
    must_reset_password: !!u.must_reset_password,
    last_login_at: u.last_login_at,
    created_at: u.created_at,
  }));

  return json({ users });
}

// POST /api/admin/users — create a client user
export async function POST(req) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const clientId = Number(body?.client_id);
  // The username may arrive as `username` (new callers) or `email` (older
  // callers) — it is stored in users.email either way.
  const username = String(body?.username ?? body?.email ?? "").trim().toLowerCase();
  const name = String(body?.name || "").trim();
  const password = String(body?.password || "");
  const permissions = sanitizePermissions(body?.permissions);

  if (!Number.isInteger(clientId)) return json({ error: "A client must be selected." }, 400);
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
  if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, 400);
  if (!permissions.length) return json({ error: "Select at least one access control." }, 400);

  const client = await query("SELECT id FROM clients WHERE id = :clientId LIMIT 1", { clientId });
  if (!client.length) return json({ error: "Selected client does not exist." }, 404);

  // Usernames are unique per client, so scope the duplicate check to this client
  // rather than the whole users table.
  const dup = await query(
    "SELECT id FROM users WHERE client_id = :clientId AND email = :username LIMIT 1",
    { clientId, username }
  );
  if (dup.length) {
    return json({ error: `Username "${username}" is already used for this client.` }, 409);
  }

  const password_hash = await hashPassword(password);
  // New client users must set their own password on first login — the
  // admin-supplied password is only a one-time credential.
  let result;
  try {
    result = await query(
      `INSERT INTO users (client_id, name, email, password_hash, role, permissions, is_restricted, must_reset_password)
       VALUES (:clientId, :name, :username, :password_hash, 'client_user', :permissions, 0, 1)`,
      { clientId, name, username, password_hash, permissions: JSON.stringify(permissions) }
    );
  } catch (err) {
    // A racing create can still collide on the per-client unique key.
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
    meta: { username, clientId, permissions },
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
