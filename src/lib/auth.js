import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "./jwt.js";
import { query } from "./db.js";
import { isMasterAdmin } from "./env.js";

/**
 * Resolve the current session from the request cookie (server components + route handlers).
 * Returns the JWT payload { sub, email, role, client_id, name, permissions } or null.
 */
export async function getSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

/**
 * Guard for API route handlers. Returns { session } or a NextResponse error.
 * Usage:
 *   const guard = await requireApi({ role: "super_admin" });
 *   if (guard.error) return guard.error;
 *   const { session } = guard;
 */
// ─────────────────────────────────────────────────────────────
// Account-status cache.
//
// requireApi() re-checks on every request that the account still exists and
// has not been restricted since its token was issued. That is one remote round
// trip (~1 RTT) added to every authenticated request, to answer a question
// whose answer changes very rarely.
//
// We cache the answer per user for a few seconds. The cost is bounded
// staleness: a restrict/delete on one instance can take up to STATUS_TTL_MS to
// be honoured by other already-warm instances. Mutating routes call
// invalidateUserStatus() so the instance serving the change reacts instantly,
// and the TTL bounds the rest.
//
// Deliberately NOT cached: the session itself (the JWT is verified on every
// request) and the user's role/permissions (they come from the signed token).
// ─────────────────────────────────────────────────────────────
const STATUS_TTL_MS = 5000;
const globalForAuth = globalThis;
const statusCache = (globalForAuth.__grelinUserStatus ??= new Map());

/**
 * Drop a user's cached status so the next request re-reads it from the DB.
 * Call after any change to a user's existence or restricted flag.
 */
export function invalidateUserStatus(userId) {
  statusCache.delete(Number(userId));
}

/**
 * Drop every cached status. For changes that affect an unknown set of users —
 * e.g. deleting a client, which cascades to all of its users.
 */
export function invalidateAllUserStatus() {
  statusCache.clear();
}

async function readUserStatus(userId) {
  const id = Number(userId);
  const hit = statusCache.get(id);
  if (hit && hit.expires > Date.now()) return hit.status;

  const rows = await query(
    "SELECT is_restricted FROM users WHERE id = :id LIMIT 1",
    { id }
  );
  const status = rows.length
    ? { exists: true, restricted: !!rows[0].is_restricted }
    : { exists: false, restricted: false };

  statusCache.set(id, { status, expires: Date.now() + STATUS_TTL_MS });
  return status;
}

export async function requireApi({ role } = {}) {
  const session = await getSession();
  if (!session) {
    return { error: json({ error: "Unauthorized" }, 401) };
  }
  if (role && session.role !== role) {
    return { error: json({ error: "Forbidden" }, 403) };
  }
  // An admin may have restricted or deleted this account after the token was
  // issued, so the token alone is not sufficient. Cached briefly — see above.
  const status = await readUserStatus(session.sub);
  if (!status.exists) {
    return { error: json({ error: "Account no longer exists." }, 401) };
  }
  if (status.restricted) {
    return { error: json({ error: "Account access has been restricted." }, 403) };
  }
  return { session };
}

/**
 * Guard for client-facing API routes. Confirms the caller is an active
 * client_user, that (optionally) they hold a given dashboard section, and hands
 * back their client_id — the tenant key every onboarding row is scoped to.
 * Permissions are read live from the DB so an admin's change takes effect at
 * once rather than waiting for the token to expire.
 *
 * Returns { session, clientId, permissions } or { error: NextResponse }.
 */
export async function requireClientApi(sectionKey) {
  const session = await getSession();
  if (!session) return { error: json({ error: "Unauthorized" }, 401) };
  if (session.role !== "client_user") return { error: json({ error: "Forbidden" }, 403) };

  const rows = await query(
    `SELECT u.client_id, u.permissions, u.is_restricted, c.status AS client_status
       FROM users u LEFT JOIN clients c ON c.id = u.client_id
      WHERE u.id = :id LIMIT 1`,
    { id: session.sub }
  );
  const me = rows[0];
  if (!me) return { error: json({ error: "Account no longer exists." }, 401) };
  if (me.is_restricted) return { error: json({ error: "Account access has been restricted." }, 403) };
  if (!me.client_id) return { error: json({ error: "No client is associated with this account." }, 403) };
  if (me.client_status === "inactive") {
    return { error: json({ error: "Your organization's access has been suspended." }, 403) };
  }

  let permissions = [];
  try {
    permissions =
      typeof me.permissions === "object" && me.permissions !== null
        ? me.permissions
        : JSON.parse(me.permissions || "[]");
  } catch {
    permissions = [];
  }
  if (sectionKey && !permissions.includes(sectionKey)) {
    return { error: json({ error: "You do not have access to this section." }, 403) };
  }

  return { session, clientId: Number(me.client_id), permissions };
}

/**
 * Guard for endpoints only the master administrator may use (e.g. creating or
 * deleting super admins, permanently deleting a client). Returns { session } or
 * { error }.
 */
export async function requireMasterApi() {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard;
  if (!isMasterAdmin(guard.session)) {
    return { error: json({ error: "Master administrator access required." }, 403) };
  }
  return guard;
}

export function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

export function clientIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip") || null;
}
