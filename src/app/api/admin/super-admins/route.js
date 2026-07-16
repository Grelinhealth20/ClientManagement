import { requireMasterApi, json, clientIp } from "@/lib/auth.js";
import { query, writeAudit } from "@/lib/db.js";
import { hashPassword } from "@/lib/crypto.js";
import { masterAdminEmail } from "@/lib/env.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function shape(u, master) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    is_restricted: !!u.is_restricted,
    must_reset_password: !!u.must_reset_password,
    last_login_at: u.last_login_at,
    created_at: u.created_at,
    is_master: String(u.email).toLowerCase() === master,
  };
}

// GET /api/admin/super-admins — list all super admins (master only).
export async function GET() {
  const guard = await requireMasterApi();
  if (guard.error) return guard.error;

  const rows = await query(
    `SELECT id, name, email, is_restricted, must_reset_password, last_login_at, created_at
       FROM users WHERE role = 'super_admin' ORDER BY created_at ASC`
  );
  const master = masterAdminEmail();
  return json({ superAdmins: rows.map((u) => shape(u, master)) });
}

// POST /api/admin/super-admins — create a super admin (master only). They get
// full super-admin access by role and must set their own password on first
// login. They sign in with a blank Client ID + their email + password.
export async function POST(req) {
  const guard = await requireMasterApi();
  if (guard.error) return guard.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!name) return json({ error: "Name is required." }, 400);
  if (!emailRe.test(email)) return json({ error: "A valid email is required." }, 400);
  if (password.length < 8) return json({ error: "Temporary password must be at least 8 characters." }, 400);

  // Super admins are identified by (email, client_id IS NULL). The composite
  // unique key treats NULLs as distinct, so uniqueness is enforced here.
  const dup = await query(
    "SELECT id FROM users WHERE email = :email AND client_id IS NULL LIMIT 1",
    { email }
  );
  if (dup.length) return json({ error: "A super admin with this email already exists." }, 409);

  const password_hash = await hashPassword(password);
  const result = await query(
    `INSERT INTO users (client_id, name, email, password_hash, role, permissions, is_restricted, must_reset_password)
     VALUES (NULL, :name, :email, :password_hash, 'super_admin', :permissions, 0, 1)`,
    { name, email, password_hash, permissions: JSON.stringify(["dashboard", "onboarding"]) }
  );

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "super_admin_created",
    entity: "user",
    entityId: result.insertId,
    meta: { email },
    ip: clientIp(req),
  });

  return json({ ok: true, id: result.insertId }, 201);
}
