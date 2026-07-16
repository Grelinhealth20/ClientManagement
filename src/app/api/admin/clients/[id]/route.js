import { query, writeAudit } from "@/lib/db.js";
import { encrypt } from "@/lib/crypto.js";
import { requireApi, json, clientIp, invalidateAllUserStatus } from "@/lib/auth.js";
import { SOW_VALUES, sanitizeList, sanitizeSystemAccess, isSaasClient } from "@/lib/domain.js";
import { CLIENT_COLUMNS, toClient } from "@/lib/clients.js";
import { isMasterAdmin } from "@/lib/env.js";
import { getS3, bucket, clientPrefix } from "@/lib/s3.js";
import { ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";

/** Permanently remove every S3 object under a client's prefix. */
async function wipeClientS3(clientId, clientCode) {
  const s3 = getS3();
  const Prefix = clientPrefix(clientId, clientCode);
  let token;
  do {
    const list = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix, ContinuationToken: token })
    );
    for (const obj of list.Contents || []) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: obj.Key }));
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Kept identical to the create route so an ID accepted at creation is also
// accepted when edited.
const CLIENT_CODE_RE = /^[A-Za-z0-9._-]{2,64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/admin/clients/:id — one client's full profile (used by the edit UI to
// always work from the freshest server-side values).
export async function GET(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid client id." }, 400);

  const rows = await query(
    `SELECT ${CLIENT_COLUMNS},
            (SELECT COUNT(*) FROM users u WHERE u.client_id = c.id) AS user_count
       FROM clients c
      WHERE c.id = :id
      LIMIT 1`,
    { id }
  );
  if (!rows.length) return json({ error: "Client not found." }, 404);
  return json({ client: toClient(rows[0]) });
}

// PUT /api/admin/clients/:id — edit a client's full profile.
//
// Every field the Create Client form captures can be edited here (Client ID,
// specialty, scope of work, granted system access, contact details, status and
// notes) so an admin can correct anything that was mistyped at creation. The
// validation mirrors the create route exactly so a value the form accepts on
// create is never rejected on edit.
export async function PUT(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid client id." }, 400);

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

  // Drop anything the UI didn't offer, and clear system access unless the client
  // is actually a SaaS client — a deselected SaaS box must not leave stale
  // access behind.
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

  // Client ID and email are both unique — a collision with any OTHER client must
  // be caught before the update so the admin gets a clear message rather than an
  // opaque constraint violation.
  const [byCode, byEmail] = await Promise.all([
    query("SELECT id FROM clients WHERE client_code = :clientCode AND id <> :id LIMIT 1", {
      clientCode,
      id,
    }),
    query("SELECT id FROM clients WHERE email = :email AND id <> :id LIMIT 1", { email, id }),
  ]);
  if (byCode.length) return json({ error: "That Client ID is already in use." }, 409);
  if (byEmail.length) return json({ error: "Another client already uses this email." }, 409);

  let result;
  try {
    result = await query(
      `UPDATE clients
          SET client_code = :client_code, name = :name, company = :company,
              specialty = :specialty, scope_of_work = :scope_of_work,
              system_access = :system_access, email = :email,
              contact_person = :contact_person, phone_enc = :phone_enc,
              start_date = :start_date, status = :status, notes = :notes
        WHERE id = :id`,
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
        id,
      }
    );
  } catch (err) {
    // A racing edit could still collide on a unique key between the checks above
    // and this update.
    if (err?.code === "ER_DUP_ENTRY") {
      return json({ error: "That Client ID or client email is already in use." }, 409);
    }
    throw err;
  }
  if (result.affectedRows === 0) return json({ error: "Client not found." }, 404);

  // Deactivating a client must take effect on the next request from its users,
  // so drop their cached status rather than serve them as active until it
  // expires.
  if (status === "inactive") invalidateAllUserStatus();

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "client_updated",
    entity: "client",
    entityId: id,
    meta: { client_code: clientCode, name, email, status, scope_of_work: scopeOfWork },
    ip: clientIp(req),
  });

  // Return the freshly-shaped client so the caller can update its view in place
  // without a second round trip.
  const rows = await query(
    `SELECT ${CLIENT_COLUMNS},
            (SELECT COUNT(*) FROM users u WHERE u.client_id = c.id) AS user_count
       FROM clients c
      WHERE c.id = :id
      LIMIT 1`,
    { id }
  );
  return json({ ok: true, client: rows.length ? toClient(rows[0]) : null });
}

// DELETE /api/admin/clients/:id — delete a client (cascades to its users)
// PATCH /api/admin/clients/:id — quick restrict/activate. Setting a client
// inactive suspends every one of its users' access in real time.
export async function PATCH(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;

  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid client id." }, 400);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const status = body?.status === "inactive" ? "inactive" : body?.status === "active" ? "active" : null;
  if (!status) return json({ error: "Provide status 'active' or 'inactive'." }, 400);

  const result = await query("UPDATE clients SET status = :status WHERE id = :id", { status, id });
  if (result.affectedRows === 0) return json({ error: "Client not found." }, 404);
  // Suspending the client must lock out its users immediately.
  if (status === "inactive") invalidateAllUserStatus();

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: status === "inactive" ? "client_restricted" : "client_activated",
    entity: "client",
    entityId: id,
    ip: clientIp(req),
  });

  return json({ ok: true, status });
}

// DELETE — PERMANENTLY remove a client and everything about them (users,
// onboarding draft, documents, submissions, provider links via ON DELETE
// CASCADE, plus every S3 object). Restricted to the master admin.
export async function DELETE(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;

  if (!isMasterAdmin(guard.session)) {
    return json(
      { error: "Only the master administrator can permanently delete a client." },
      403
    );
  }

  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid client id." }, 400);

  const rows = await query("SELECT client_code FROM clients WHERE id = :id LIMIT 1", { id });
  if (!rows.length) return json({ error: "Client not found." }, 404);

  // Wipe S3 first (the DB row is what maps to the prefix; once it's gone we
  // couldn't reconstruct the prefix), then cascade-delete the DB rows.
  await wipeClientS3(id, rows[0].client_code);
  await query("DELETE FROM clients WHERE id = :id", { id });
  invalidateAllUserStatus();

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "client_permanently_deleted",
    entity: "client",
    entityId: id,
    meta: { client_code: rows[0].client_code },
    ip: clientIp(req),
  });

  return json({ ok: true });
}
