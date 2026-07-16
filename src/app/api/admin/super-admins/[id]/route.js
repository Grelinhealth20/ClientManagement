import { requireMasterApi, json, clientIp, invalidateUserStatus } from "@/lib/auth.js";
import { query, writeAudit } from "@/lib/db.js";
import { hashPassword } from "@/lib/crypto.js";
import { masterAdminEmail } from "@/lib/env.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Load a super admin, or null. Guards every action here. */
async function loadTarget(id) {
  const rows = await query(
    "SELECT id, name, email, role FROM users WHERE id = :id AND role = 'super_admin' LIMIT 1",
    { id }
  );
  return rows[0] || null;
}

function isMasterRow(row) {
  return String(row.email).toLowerCase() === masterAdminEmail();
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// PATCH /api/admin/super-admins/:id — edit name/email, reset password, and/or
// restrict access. Any subset of those may be sent in one call.
export async function PATCH(req, { params }) {
  const guard = await requireMasterApi();
  if (guard.error) return guard.error;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid id." }, 400);

  const target = await loadTarget(id);
  if (!target) return json({ error: "Super admin not found." }, 404);
  if (isMasterRow(target)) return json({ error: "The master admin cannot be modified." }, 403);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const actions = [];

  // Edit name / email
  if (typeof body?.name === "string" || typeof body?.email === "string") {
    const name = String(body?.name ?? target.name ?? "").trim();
    const email = String(body?.email ?? target.email ?? "").trim().toLowerCase();
    if (!name) return json({ error: "Name is required." }, 400);
    if (!emailRe.test(email)) return json({ error: "A valid email is required." }, 400);
    if (email === masterAdminEmail()) return json({ error: "That email is reserved for the master admin." }, 409);
    const dup = await query(
      "SELECT id FROM users WHERE email = :email AND client_id IS NULL AND id <> :id LIMIT 1",
      { email, id }
    );
    if (dup.length) return json({ error: "Another super admin already uses this email." }, 409);
    await query("UPDATE users SET name = :name, email = :email WHERE id = :id", { name, email, id });
    actions.push("super_admin_updated");
  }

  // Restrict / restore
  if (typeof body?.restricted === "boolean") {
    await query("UPDATE users SET is_restricted = :r WHERE id = :id", { r: body.restricted ? 1 : 0, id });
    invalidateUserStatus(id);
    actions.push(body.restricted ? "super_admin_restricted" : "super_admin_restored");
  }

  // Reset password
  if (typeof body?.password === "string") {
    if (body.password.length < 8) return json({ error: "Password must be at least 8 characters." }, 400);
    const password_hash = await hashPassword(body.password);
    await query("UPDATE users SET password_hash = :h, must_reset_password = 1 WHERE id = :id", { h: password_hash, id });
    actions.push("super_admin_password_reset");
  }

  if (!actions.length) return json({ error: "Nothing to update." }, 400);

  for (const action of actions) {
    await writeAudit({ actorId: guard.session.sub, actorEmail: guard.session.email, action, entity: "user", entityId: id, ip: clientIp(req) });
  }
  return json({ ok: true });
}

// DELETE /api/admin/super-admins/:id — remove a super admin (master only). The
// master account and the caller's own account cannot be deleted.
export async function DELETE(req, { params }) {
  const guard = await requireMasterApi();
  if (guard.error) return guard.error;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid id." }, 400);

  const target = await loadTarget(id);
  if (!target) return json({ error: "Super admin not found." }, 404);
  if (isMasterRow(target)) return json({ error: "The master admin cannot be deleted." }, 403);
  if (id === Number(guard.session.sub)) return json({ error: "You cannot delete your own account." }, 403);

  await query("DELETE FROM users WHERE id = :id AND role = 'super_admin'", { id });
  invalidateUserStatus(id);

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "super_admin_deleted",
    entity: "user",
    entityId: id,
    meta: { email: target.email },
    ip: clientIp(req),
  });

  return json({ ok: true });
}
