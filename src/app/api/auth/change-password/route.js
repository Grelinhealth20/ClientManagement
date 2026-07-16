import { cookies } from "next/headers";
import { query, writeAudit } from "@/lib/db.js";
import { verifyPassword, hashPassword } from "@/lib/crypto.js";
import { signSession, SESSION_COOKIE, cookieOptions } from "@/lib/jwt.js";
import { requireApi, json, clientIp } from "@/lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/auth/change-password
// Self-service password change for the authenticated user. Used for the forced
// first-login reset and for voluntary changes. Verifies the current password,
// stores the new hash, and clears the must_reset_password flag.
export async function POST(req) {
  // Any authenticated, non-restricted user may change their own password.
  const guard = await requireApi();
  if (guard.error) return guard.error;
  const { session } = guard;

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const currentPassword = String(body?.current_password || "");
  const newPassword = String(body?.new_password || "");
  if (!currentPassword || !newPassword) {
    return json({ error: "Current and new passwords are required." }, 400);
  }
  if (newPassword.length < 8) {
    return json({ error: "New password must be at least 8 characters." }, 400);
  }

  const rows = await query(
    `SELECT id, client_id, name, email, role, permissions, password_hash
       FROM users WHERE id = :id LIMIT 1`,
    { id: session.sub }
  );
  const user = rows[0];
  if (!user) return json({ error: "Account no longer exists." }, 401);

  const currentOk = await verifyPassword(currentPassword, user.password_hash);
  if (!currentOk) {
    await writeAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: "password_change_failed",
      entity: "auth",
      entityId: user.id,
      ip: clientIp(req),
    });
    return json({ error: "Your current password is incorrect." }, 400);
  }

  // currentPassword is now known to be the account's password, so the new
  // password matches the stored hash exactly when it equals currentPassword.
  // A second bcrypt compare against the hash would cost another full KDF run
  // to answer a question plain equality already answers.
  if (newPassword === currentPassword) {
    return json({ error: "New password must be different from the current password." }, 400);
  }

  const password_hash = await hashPassword(newPassword);
  await query(
    "UPDATE users SET password_hash = :password_hash, must_reset_password = 0 WHERE id = :id",
    { password_hash, id: user.id }
  );

  // Re-issue the session so the token no longer flags a required reset.
  const permissions = safeJson(user.permissions, []);
  const token = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    client_id: user.client_id,
    permissions,
    is_restricted: false,
    must_reset: false,
  });
  cookies().set(SESSION_COOKIE, token, cookieOptions());

  await writeAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: "password_changed",
    entity: "auth",
    entityId: user.id,
    ip: clientIp(req),
  });

  return json({ ok: true });
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
