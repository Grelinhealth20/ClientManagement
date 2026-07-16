import { cookies } from "next/headers";
import { query, writeAudit } from "@/lib/db.js";
import { verifyPassword, verifyAbsentUser } from "@/lib/crypto.js";
import { signSession, SESSION_COOKIE, cookieOptions } from "@/lib/jwt.js";
import { json, clientIp } from "@/lib/auth.js";
import { checkLoginRate } from "@/lib/rateLimit.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  // The username is stored in users.email. Client users are identified by
  // (Client ID + Username): usernames are only unique within a client, so the
  // same username may exist under several clients. Super admins belong to no
  // client and sign in with a blank Client ID.
  const username = String(body?.username ?? body?.email ?? "").trim().toLowerCase();
  const clientCode = String(body?.client_id || "").trim();
  const password = String(body?.password || "");
  if (!username || !password) {
    return json({ error: "Username and password are required." }, 400);
  }

  // Rate-limit on the credential actually presented, so attempts against
  // "jsmith" at one client don't lock out "jsmith" at another.
  const rateKey = clientCode ? `${clientCode}:${username}` : username;

  // The rate check and the user lookup are independent, and the DB is remote
  // (~1 RTT each). Issue them concurrently so the login costs one round trip
  // here instead of two. The lookup is wasted when the caller is rate-limited,
  // which is the rare path and costs no extra wall-clock time.
  const [rate, rows] = await Promise.all([
    checkLoginRate(rateKey),
    clientCode
      ? query(
          `SELECT u.id, u.client_id, u.name, u.email, u.password_hash, u.role, u.permissions,
                  u.is_restricted, u.must_reset_password, c.status AS client_status
             FROM users u
             JOIN clients c ON c.id = u.client_id
            WHERE c.client_code = :clientCode AND u.email = :username
            LIMIT 1`,
          { clientCode, username }
        )
      : // No Client ID given: only an account that belongs to no client (i.e. a
        // super admin) can match. Without this, a client user could sign in
        // while omitting their Client ID entirely.
        query(
          `SELECT id, client_id, name, email, password_hash, role, permissions,
                  is_restricted, must_reset_password
             FROM users
            WHERE email = :username AND client_id IS NULL
            LIMIT 1`,
          { username }
        ),
  ]);

  if (rate.limited) {
    const res = json(
      { error: "Too many failed attempts. Please try again later." },
      429
    );
    res.headers.set("Retry-After", String(rate.retryAfterSeconds));
    return res;
  }

  const user = rows[0];

  // Uniform failure to avoid user enumeration: an unknown username must cost
  // the same as a known one, so it spends an equivalent bcrypt compare instead
  // of returning early.
  const ok = user
    ? await verifyPassword(password, user.password_hash)
    : await verifyAbsentUser(password);
  if (!user || !ok) {
    await writeAudit({
      actorEmail: rateKey,
      action: "login_failed",
      entity: "auth",
      ip: clientIp(req),
    });
    // Deliberately does not say which of the three inputs was wrong.
    return json({ error: "Invalid Client ID, username or password." }, 401);
  }

  if (user.is_restricted) {
    return json({ error: "Your account access has been restricted. Contact your administrator." }, 403);
  }
  // A suspended (inactive) client locks out all of its users.
  if (user.client_status === "inactive") {
    return json({ error: "Your organization's access has been suspended. Contact your administrator." }, 403);
  }

  const permissions = safeJson(user.permissions, []);
  const mustReset = !!user.must_reset_password;
  const token = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    client_id: user.client_id,
    permissions,
    is_restricted: false,
    must_reset: mustReset,
  });

  cookies().set(SESSION_COOKIE, token, cookieOptions());

  // Neither write feeds the response, and they touch different tables, so run
  // them concurrently — one round trip instead of two. They are still awaited:
  // the function may be frozen the moment we respond, so firing and forgetting
  // would silently lose logins from the audit trail.
  await Promise.all([
    query("UPDATE users SET last_login_at = NOW() WHERE id = :id", { id: user.id }),
    writeAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: "login_success",
      entity: "auth",
      entityId: user.id,
      ip: clientIp(req),
    }),
  ]);

  return json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    must_reset: mustReset,
    redirect: user.role === "super_admin" ? "/admin" : "/dashboard",
  });
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
