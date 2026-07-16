import { query, writeAudit, withTransaction } from "@/lib/db.js";
import { encrypt, hashPassword } from "@/lib/crypto.js";
import { requireApi, json, clientIp } from "@/lib/auth.js";
import { sanitizePermissions } from "@/lib/permissions.js";
import { SOW_VALUES, sanitizeList, sanitizeSystemAccess, isSaasClient } from "@/lib/domain.js";
import { CLIENT_COLUMNS, toClient } from "@/lib/clients.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Client IDs are admin-typed and appear in the login form, so they are kept to
// characters that survive typing and URLs without escaping.
const CLIENT_CODE_RE = /^[A-Za-z0-9._-]{2,64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Usernames are typed at the login form. '@' stays allowed so an email may still
// be used as a username, which is what existing accounts have.
const USERNAME_RE = /^[A-Za-z0-9._@-]{2,191}$/;

// GET /api/admin/clients — list all clients with user counts
export async function GET() {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;

  const rows = await query(`
    SELECT ${CLIENT_COLUMNS},
           (SELECT COUNT(*) FROM users u WHERE u.client_id = c.id) AS user_count
      FROM clients c
     ORDER BY c.created_at DESC
  `);

  const clients = rows.map(toClient);
  return json({ clients });
}

// POST /api/admin/clients — create a client
export async function POST(req) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const clientCode = String(body?.client_code || "").trim();
  const name = String(body?.name || "").trim();
  const company = body?.company ? String(body.company).trim() : null;
  const specialty = body?.specialty ? String(body.specialty).trim() : null;
  const email = String(body?.email || "").trim().toLowerCase();
  const contactPerson = body?.contact_person ? String(body.contact_person).trim() : null;
  const phone = body?.phone ? String(body.phone).trim() : null;
  const startDate = body?.start_date ? String(body.start_date).trim() : null;
  const notes = body?.notes ? String(body.notes).trim() : null;
  const status = body?.status === "inactive" ? "inactive" : "active";

  // Drop anything the UI didn't offer, and clear system access unless the
  // client is actually a SaaS client — a deselected SaaS box must not leave
  // stale access behind.
  const scopeOfWork = sanitizeList(SOW_VALUES, body?.scope_of_work);
  const systemAccess = sanitizeSystemAccess(scopeOfWork, body?.system_access);

  if (!clientCode) return json({ error: "Client ID is required." }, 400);
  if (!CLIENT_CODE_RE.test(clientCode)) {
    return json(
      { error: "Client ID may only contain letters, numbers, dots, hyphens and underscores." },
      400
    );
  }
  if (!name) return json({ error: "Client name is required." }, 400);
  if (!emailRe.test(email)) return json({ error: "A valid client email is required." }, 400);
  if (!scopeOfWork.length) return json({ error: "Select at least one scope of work." }, 400);
  if (isSaasClient(scopeOfWork) && !systemAccess.length) {
    return json({ error: "Select at least one system access for a SaaS client." }, 400);
  }
  if (startDate && !DATE_RE.test(startDate)) {
    return json({ error: "Client start date must be a valid date." }, 400);
  }

  // The client's first user is created in the same transaction — optional, but
  // if a username is given it must be usable.
  // Any number of users may be provisioned with the client. Rows the admin left
  // completely blank are ignored so an untouched extra row isn't an error.
  const rawUsers = Array.isArray(body?.users) ? body.users : body?.user ? [body.user] : [];
  const users = rawUsers
    .map((u) => ({
      username: u?.username ? String(u.username).trim().toLowerCase() : "",
      password: u?.password ? String(u.password) : "",
      name: u?.name ? String(u.name).trim() : "",
      permissions: sanitizePermissions(u?.permissions),
    }))
    .filter((u) => u.username || u.password || u.name);

  for (const u of users) {
    if (!u.username) return json({ error: "Every user needs a username." }, 400);
    if (!USERNAME_RE.test(u.username)) {
      return json(
        {
          error: `Username "${u.username}" may only contain letters, numbers, dots, hyphens, underscores and @.`,
        },
        400
      );
    }
    if (!u.password) {
      return json({ error: `A temporary password is required for "${u.username}".` }, 400);
    }
    if (u.password.length < 8) {
      return json({ error: `The temporary password for "${u.username}" must be at least 8 characters.` }, 400);
    }
    if (!u.permissions.length) {
      return json({ error: `Select at least one access control for "${u.username}".` }, 400);
    }
  }

  // Usernames are unique per client, so a duplicate inside this one request
  // would only surface as an opaque constraint violation mid-transaction.
  const dupe = firstDuplicate(users.map((u) => u.username));
  if (dupe) {
    return json({ error: `Username "${dupe}" is used more than once for this client.` }, 400);
  }

  const [byCode, byEmail] = await Promise.all([
    query("SELECT id FROM clients WHERE client_code = :clientCode LIMIT 1", { clientCode }),
    query("SELECT id FROM clients WHERE email = :email LIMIT 1", { email }),
  ]);
  if (byCode.length) return json({ error: "That Client ID is already in use." }, 409);
  if (byEmail.length) return json({ error: "A client with this email already exists." }, 409);

  // Hash before opening the transaction: bcrypt is CPU-bound, and hashing
  // inside would hold a pooled connection open for ~240ms per user.
  const hashes = await Promise.all(users.map((u) => hashPassword(u.password)));

  let created;
  try {
    // The client and all of its users are created together or not at all — a
    // client with half its users provisioned is worse than a failed request.
    created = await withTransaction(async (tx) => {
      const result = await tx(
        `INSERT INTO clients
           (client_code, name, company, specialty, scope_of_work, system_access,
            email, contact_person, phone_enc, start_date, status, notes)
         VALUES
           (:client_code, :name, :company, :specialty, :scope_of_work, :system_access,
            :email, :contact_person, :phone_enc, :start_date, :status, :notes)`,
        {
          client_code: clientCode,
          name,
          company,
          specialty,
          scope_of_work: JSON.stringify(scopeOfWork),
          system_access: JSON.stringify(systemAccess),
          email,
          contact_person: contactPerson,
          phone_enc: encrypt(phone),
          start_date: startDate || null,
          status,
          notes,
        }
      );
      const clientId = result.insertId;

      const createdUsers = [];
      for (const [i, u] of users.entries()) {
        const row = await tx(
          `INSERT INTO users
             (client_id, name, email, password_hash, role, permissions, is_restricted, must_reset_password)
           VALUES
             (:client_id, :name, :email, :password_hash, 'client_user', :permissions, 0, 1)`,
          {
            client_id: clientId,
            name: u.name || u.username,
            email: u.username,
            password_hash: hashes[i],
            permissions: JSON.stringify(u.permissions),
          }
        );
        createdUsers.push({ id: row.insertId, username: u.username, permissions: u.permissions });
      }
      return { clientId, users: createdUsers };
    });
  } catch (err) {
    // Racing creates can still collide on the unique keys between the check
    // above and the insert.
    if (err?.code === "ER_DUP_ENTRY") {
      return json({ error: "That Client ID, client email or username is already in use." }, 409);
    }
    throw err;
  }

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "client_created",
    entity: "client",
    entityId: created.clientId,
    meta: { client_code: clientCode, name, email, scope_of_work: scopeOfWork },
    ip: clientIp(req),
  });
  // One audit row per user, so the trail names who was provisioned rather than
  // just how many.
  await Promise.all(
    created.users.map((u) =>
      writeAudit({
        actorId: guard.session.sub,
        actorEmail: guard.session.email,
        action: "user_created",
        entity: "user",
        entityId: u.id,
        meta: { client_code: clientCode, username: u.username, permissions: u.permissions },
        ip: clientIp(req),
      })
    )
  );

  return json(
    { ok: true, id: created.clientId, user_ids: created.users.map((u) => u.id) },
    201
  );
}

/** First value that appears more than once, or null. */
function firstDuplicate(values) {
  const seen = new Set();
  for (const v of values) {
    if (seen.has(v)) return v;
    seen.add(v);
  }
  return null;
}

