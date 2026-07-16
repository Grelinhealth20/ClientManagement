import { query, writeAudit } from "@/lib/db.js";
import { hashPassword, generateTempPassword } from "@/lib/crypto.js";
import { requireApi, json, clientIp } from "@/lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/users/:id/reset-password
// Body: { password?: string }  — if omitted, a strong temp password is generated & returned.
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

  let password = body?.password ? String(body.password) : "";
  let generated = null;
  if (!password) {
    password = generateTempPassword();
    generated = password;
  } else if (password.length < 8) {
    return json({ error: "Password must be at least 8 characters." }, 400);
  }

  // Hashing is ~1 bcrypt cost and the lookup is ~1 remote round trip; neither
  // depends on the other, so overlap them rather than paying for both in turn.
  const [target, password_hash] = await Promise.all([
    query("SELECT id, role FROM users WHERE id = :id LIMIT 1", { id }),
    hashPassword(password),
  ]);

  if (!target.length) return json({ error: "User not found." }, 404);
  if (target[0].role === "super_admin") {
    return json({ error: "Super admin passwords cannot be reset here." }, 403);
  }
  // An admin-set password is a one-time credential — require the user to choose
  // their own on next login.
  await query(
    "UPDATE users SET password_hash = :password_hash, must_reset_password = 1 WHERE id = :id",
    { password_hash, id }
  );

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "user_password_reset",
    entity: "user",
    entityId: id,
    ip: clientIp(req),
  });

  return json({ ok: true, temp_password: generated });
}
