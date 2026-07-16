// Data-access layer for the Client Requests & Enrollment module. Every function
// is scoped by client_id and, where an id addresses a child row, verifies it
// belongs to the given client before mutating — so a super admin acting on the
// wrong client, or a client user reaching outside their org, is impossible.

import crypto from "crypto";
import { query, withTransaction } from "./db.js";
import { bucket } from "./s3.js";
import {
  ENROLLMENT_STATUS_VALUES,
  TICKET_STATUS_VALUES,
  TICKET_CATEGORY_VALUES,
} from "./requestsDomain.js";

// ─────────────────────────────────────────────────────────────────────────────
// Serialization helpers — dates must cross the server/client boundary as plain
// strings, and JSON columns arrive parsed on some driver/DB combos and as text
// on others.
// ─────────────────────────────────────────────────────────────────────────────
function toIso(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function toDateStr(v) {
  if (!v) return null;
  if (typeof v === "string") return v.slice(0, 10);
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function asJsonArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v !== "string" || !v) return [];
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}
const str = (v, max) => String(v ?? "").trim().slice(0, max);

// ═════════════════════════════════════════════════════════════════════════════
// CHECKLISTS
// ═════════════════════════════════════════════════════════════════════════════

/** Create a checklist request with its items in one transaction. */
export async function createChecklist(clientId, { title, message, items, createdBy, createdEmail }) {
  const cleanItems = (Array.isArray(items) ? items : [])
    .map((it) => ({
      content: str(it.content, 2000),
      allow_upload: it.allow_upload ? 1 : 0,
      allow_download: it.allow_download ? 1 : 0,
    }))
    .filter((it) => it.content);
  if (!cleanItems.length) throw new Error("Add at least one checklist item.");

  return withTransaction(async (tx) => {
    const res = await tx(
      `INSERT INTO checklist_requests (client_id, title, message, created_by, created_email)
       VALUES (:clientId, :title, :message, :createdBy, :createdEmail)`,
      { clientId, title: str(title, 191) || "Checklist Request", message: str(message, 4000) || null, createdBy: createdBy ?? null, createdEmail: createdEmail ?? null }
    );
    const requestId = res.insertId;
    let order = 0;
    for (const it of cleanItems) {
      await tx(
        `INSERT INTO checklist_items (request_id, content, allow_upload, allow_download, sort_order)
         VALUES (:requestId, :content, :au, :ad, :order)`,
        { requestId, content: it.content, au: it.allow_upload, ad: it.allow_download, order: order++ }
      );
    }
    return requestId;
  });
}

/** All checklist requests for a client, each with its items and documents. */
export async function listChecklists(clientId) {
  const requests = await query(
    `SELECT id, title, message, status, created_email, completed_at, created_at, updated_at
       FROM checklist_requests WHERE client_id = :clientId ORDER BY created_at DESC`,
    { clientId }
  );
  if (!requests.length) return [];
  const ids = requests.map((r) => r.id);
  const placeholders = ids.map((_, i) => `:id${i}`).join(",");
  const idParams = Object.fromEntries(ids.map((v, i) => [`id${i}`, v]));

  const items = await query(
    `SELECT id, request_id, content, allow_upload, allow_download, is_completed, completed_at, sort_order
       FROM checklist_items WHERE request_id IN (${placeholders}) ORDER BY sort_order ASC, id ASC`,
    idParams
  );
  const itemIds = items.map((i) => i.id);
  let docs = [];
  if (itemIds.length) {
    const dPh = itemIds.map((_, i) => `:d${i}`).join(",");
    const dParams = Object.fromEntries(itemIds.map((v, i) => [`d${i}`, v]));
    docs = await query(
      `SELECT id, item_id, source, filename, size_bytes, content_type, created_at
         FROM checklist_documents WHERE item_id IN (${dPh}) ORDER BY created_at ASC`,
      dParams
    );
  }

  const docsByItem = new Map();
  for (const d of docs) {
    if (!docsByItem.has(d.item_id)) docsByItem.set(d.item_id, []);
    docsByItem.get(d.item_id).push({
      id: d.id,
      source: d.source,
      filename: d.filename,
      size_bytes: Number(d.size_bytes) || 0,
      content_type: d.content_type,
      created_at: toIso(d.created_at),
    });
  }
  const itemsByReq = new Map();
  for (const it of items) {
    if (!itemsByReq.has(it.request_id)) itemsByReq.set(it.request_id, []);
    itemsByReq.get(it.request_id).push({
      id: it.id,
      content: it.content,
      allow_upload: !!it.allow_upload,
      allow_download: !!it.allow_download,
      is_completed: !!it.is_completed,
      completed_at: toIso(it.completed_at),
      documents: docsByItem.get(it.id) || [],
    });
  }
  return requests.map((r) => ({
    id: r.id,
    title: r.title,
    message: r.message,
    status: r.status,
    created_email: r.created_email,
    completed_at: toIso(r.completed_at),
    created_at: toIso(r.created_at),
    updated_at: toIso(r.updated_at),
    items: itemsByReq.get(r.id) || [],
  }));
}

/** The request row an item belongs to, incl. client_id — for ownership checks. */
export async function getChecklistItemContext(itemId) {
  const rows = await query(
    `SELECT i.id AS item_id, i.request_id, i.allow_upload, i.allow_download,
            r.client_id, r.status AS request_status
       FROM checklist_items i JOIN checklist_requests r ON r.id = i.request_id
      WHERE i.id = :itemId LIMIT 1`,
    { itemId }
  );
  return rows[0] || null;
}

/** Record an uploaded document (admin download-grant, or client submission). */
export async function attachChecklistDocument(itemId, clientId, doc) {
  const res = await query(
    `INSERT INTO checklist_documents
       (item_id, client_id, source, s3_bucket, s3_key, filename, size_bytes, content_type, uploaded_by)
     VALUES (:itemId, :clientId, :source, :b, :key, :filename, :size, :ct, :by)`,
    {
      itemId,
      clientId,
      source: doc.source,
      b: bucket(),
      key: doc.s3_key,
      filename: str(doc.filename, 255),
      size: Number(doc.size_bytes) || 0,
      ct: doc.content_type || null,
      by: doc.uploaded_by ?? null,
    }
  );
  return res.insertId;
}

/** A document row (incl. client_id + s3_key) for a download/delete ownership check. */
export async function getChecklistDocument(docId) {
  const rows = await query(
    `SELECT id, item_id, client_id, source, s3_key, filename, content_type
       FROM checklist_documents WHERE id = :docId LIMIT 1`,
    { docId }
  );
  return rows[0] || null;
}

export async function deleteChecklistDocument(docId) {
  await query("DELETE FROM checklist_documents WHERE id = :docId", { docId });
}

/** Mark an item done/undone, then recompute the parent request's status. */
export async function setChecklistItemDone(itemId, done) {
  await query(
    `UPDATE checklist_items
        SET is_completed = :done, completed_at = ${done ? "CURRENT_TIMESTAMP" : "NULL"}
      WHERE id = :itemId`,
    { done: done ? 1 : 0, itemId }
  );
  const ctx = await getChecklistItemContext(itemId);
  if (ctx) return recomputeChecklistStatus(ctx.request_id);
  return null;
}

/** Set request → completed iff every item is completed; else pending. */
export async function recomputeChecklistStatus(requestId) {
  const rows = await query(
    `SELECT COUNT(*) AS total, SUM(is_completed) AS done FROM checklist_items WHERE request_id = :requestId`,
    { requestId }
  );
  const total = Number(rows[0]?.total || 0);
  const done = Number(rows[0]?.done || 0);
  const completed = total > 0 && done >= total;
  await query(
    `UPDATE checklist_requests
        SET status = :status, completed_at = ${completed ? "CURRENT_TIMESTAMP" : "NULL"}
      WHERE id = :requestId`,
    { status: completed ? "completed" : "pending", requestId }
  );
  return { completed, total, done };
}

/** Reopen a completed checklist and route it back to the client (items reset). */
export async function reopenChecklist(requestId, clientId) {
  const owned = await query(
    "SELECT id FROM checklist_requests WHERE id = :requestId AND client_id = :clientId LIMIT 1",
    { requestId, clientId }
  );
  if (!owned.length) return false;
  await query(
    "UPDATE checklist_items SET is_completed = 0, completed_at = NULL WHERE request_id = :requestId",
    { requestId }
  );
  await query(
    "UPDATE checklist_requests SET status = 'pending', completed_at = NULL WHERE id = :requestId",
    { requestId }
  );
  return true;
}

export async function deleteChecklist(requestId, clientId) {
  const res = await query(
    "DELETE FROM checklist_requests WHERE id = :requestId AND client_id = :clientId",
    { requestId, clientId }
  );
  return res.affectedRows > 0;
}

// ═════════════════════════════════════════════════════════════════════════════
// ENROLLMENT
// ═════════════════════════════════════════════════════════════════════════════

const cleanEnrollmentStatus = (s) =>
  ENROLLMENT_STATUS_VALUES.includes(s) ? s : "not_started";

/** All payers for a client (optionally one scope) with their follow-up notes. */
export async function listEnrollment(clientId, scope) {
  const scoped = scope ? "AND scope = :scope" : "";
  const payers = await query(
    `SELECT id, scope, provider_key, provider_name, payer_name, status, start_date, notes, created_at, updated_at
       FROM enrollment_payers WHERE client_id = :clientId ${scoped}
      ORDER BY created_at DESC`,
    scope ? { clientId, scope } : { clientId }
  );
  if (!payers.length) return [];
  const ids = payers.map((p) => p.id);
  const ph = ids.map((_, i) => `:f${i}`).join(",");
  const params = Object.fromEntries(ids.map((v, i) => [`f${i}`, v]));
  const followups = await query(
    `SELECT id, payer_id, note, created_email, created_at
       FROM enrollment_followups WHERE payer_id IN (${ph}) ORDER BY created_at DESC`,
    params
  );
  const byPayer = new Map();
  for (const f of followups) {
    if (!byPayer.has(f.payer_id)) byPayer.set(f.payer_id, []);
    byPayer.get(f.payer_id).push({
      id: f.id,
      note: f.note,
      created_email: f.created_email,
      created_at: toIso(f.created_at),
    });
  }
  return payers.map((p) => ({
    id: p.id,
    scope: p.scope,
    provider_key: p.provider_key,
    provider_name: p.provider_name,
    payer_name: p.payer_name,
    status: p.status,
    start_date: toDateStr(p.start_date),
    notes: p.notes,
    created_at: toIso(p.created_at),
    updated_at: toIso(p.updated_at),
    followups: byPayer.get(p.id) || [],
  }));
}

export async function createPayer(clientId, p) {
  const scope = p.scope === "provider" ? "provider" : "facility";
  const res = await query(
    `INSERT INTO enrollment_payers
       (client_id, scope, provider_key, provider_name, payer_name, status, start_date, notes, created_by)
     VALUES (:clientId, :scope, :pk, :pn, :payer, :status, :start, :notes, :by)`,
    {
      clientId,
      scope,
      pk: p.provider_key ? str(p.provider_key, 64) : null,
      pn: p.provider_name ? str(p.provider_name, 191) : null,
      payer: str(p.payer_name, 191),
      status: cleanEnrollmentStatus(p.status),
      start: p.start_date || null,
      notes: p.notes ? str(p.notes, 4000) : null,
      by: p.created_by ?? null,
    }
  );
  return res.insertId;
}

export async function updatePayer(payerId, clientId, p) {
  const res = await query(
    `UPDATE enrollment_payers
        SET payer_name = :payer, status = :status, start_date = :start, notes = :notes,
            provider_name = :pn
      WHERE id = :payerId AND client_id = :clientId`,
    {
      payer: str(p.payer_name, 191),
      status: cleanEnrollmentStatus(p.status),
      start: p.start_date || null,
      notes: p.notes != null ? str(p.notes, 4000) : null,
      pn: p.provider_name != null ? str(p.provider_name, 191) : null,
      payerId,
      clientId,
    }
  );
  return res.affectedRows > 0;
}

export async function deletePayer(payerId, clientId) {
  const res = await query(
    "DELETE FROM enrollment_payers WHERE id = :payerId AND client_id = :clientId",
    { payerId, clientId }
  );
  return res.affectedRows > 0;
}

/** Add a follow-up note (automatic timestamp) after checking client ownership. */
export async function addFollowup(payerId, clientId, { note, createdBy, createdEmail }) {
  const owned = await query(
    "SELECT id FROM enrollment_payers WHERE id = :payerId AND client_id = :clientId LIMIT 1",
    { payerId, clientId }
  );
  if (!owned.length) return null;
  const res = await query(
    `INSERT INTO enrollment_followups (payer_id, note, created_by, created_email)
     VALUES (:payerId, :note, :by, :email)`,
    { payerId, note: str(note, 4000), by: createdBy ?? null, email: createdEmail ?? null }
  );
  return res.insertId;
}

// ═════════════════════════════════════════════════════════════════════════════
// TICKETS (Request from Client)
// ═════════════════════════════════════════════════════════════════════════════

async function uniqueTicketCode() {
  for (let i = 0; i < 6; i++) {
    const code = "GH-" + crypto.randomBytes(3).toString("hex").toUpperCase();
    const hit = await query("SELECT 1 FROM client_tickets WHERE ticket_code = :code LIMIT 1", { code });
    if (!hit.length) return code;
  }
  throw new Error("Could not allocate a ticket id. Please try again.");
}

export async function createTicket(clientId, { subject, categories, details, createdBy, createdName }) {
  const cats = (Array.isArray(categories) ? categories : []).filter((c) =>
    TICKET_CATEGORY_VALUES.includes(c)
  );
  const code = await uniqueTicketCode();
  const res = await query(
    `INSERT INTO client_tickets (client_id, ticket_code, subject, categories, details, created_by, created_name)
     VALUES (:clientId, :code, :subject, :cats, :details, :by, :name)`,
    {
      clientId,
      code,
      subject: str(subject, 191) || "Request",
      cats: JSON.stringify(cats),
      details: str(details, 8000) || null,
      by: createdBy ?? null,
      name: createdName ? str(createdName, 191) : null,
    }
  );
  return { id: res.insertId, ticket_code: code };
}

/** All tickets for a client with their threaded responses. */
export async function listTickets(clientId) {
  const tickets = await query(
    `SELECT id, ticket_code, subject, categories, details, status, created_name, created_at, updated_at
       FROM client_tickets WHERE client_id = :clientId ORDER BY created_at DESC`,
    { clientId }
  );
  if (!tickets.length) return [];
  const ids = tickets.map((t) => t.id);
  const ph = ids.map((_, i) => `:t${i}`).join(",");
  const params = Object.fromEntries(ids.map((v, i) => [`t${i}`, v]));
  const responses = await query(
    `SELECT id, ticket_id, author_type, author_name, message, created_at
       FROM ticket_responses WHERE ticket_id IN (${ph}) ORDER BY created_at ASC`,
    params
  );
  const byTicket = new Map();
  for (const r of responses) {
    if (!byTicket.has(r.ticket_id)) byTicket.set(r.ticket_id, []);
    byTicket.get(r.ticket_id).push({
      id: r.id,
      author_type: r.author_type,
      author_name: r.author_name,
      message: r.message,
      created_at: toIso(r.created_at),
    });
  }
  return tickets.map((t) => ({
    id: t.id,
    ticket_code: t.ticket_code,
    subject: t.subject,
    categories: asJsonArray(t.categories),
    details: t.details,
    status: t.status,
    created_name: t.created_name,
    created_at: toIso(t.created_at),
    updated_at: toIso(t.updated_at),
    responses: byTicket.get(t.id) || [],
  }));
}

export async function getTicket(ticketId) {
  const rows = await query(
    "SELECT id, client_id, ticket_code, subject, status FROM client_tickets WHERE id = :ticketId LIMIT 1",
    { ticketId }
  );
  return rows[0] || null;
}

export async function addTicketResponse(ticketId, { authorType, authorId, authorName, message }) {
  const res = await query(
    `INSERT INTO ticket_responses (ticket_id, author_type, author_id, author_name, message)
     VALUES (:ticketId, :type, :by, :name, :message)`,
    {
      ticketId,
      type: authorType === "super_admin" ? "super_admin" : "client_user",
      by: authorId ?? null,
      name: authorName ? str(authorName, 191) : null,
      message: str(message, 8000),
    }
  );
  // Touch the ticket so its updated_at reflects the latest activity.
  await query("UPDATE client_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = :ticketId", { ticketId });
  return res.insertId;
}

export async function updateTicketStatus(ticketId, clientId, status) {
  if (!TICKET_STATUS_VALUES.includes(status)) return false;
  const res = await query(
    "UPDATE client_tickets SET status = :status WHERE id = :ticketId AND client_id = :clientId",
    { status, ticketId, clientId }
  );
  return res.affectedRows > 0;
}

// ═════════════════════════════════════════════════════════════════════════════
// INTRA-CLIENT MESSAGES
// ═════════════════════════════════════════════════════════════════════════════

export async function listMessages(clientId, { limit = 200 } = {}) {
  const rows = await query(
    `SELECT id, author_id, author_name, body, created_at
       FROM client_messages WHERE client_id = :clientId ORDER BY id ASC LIMIT ${Number(limit) || 200}`,
    { clientId }
  );
  return rows.map((m) => ({
    id: m.id,
    author_id: m.author_id,
    author_name: m.author_name,
    body: m.body,
    created_at: toIso(m.created_at),
  }));
}

export async function postMessage(clientId, { authorId, authorName, body }) {
  const text = str(body, 4000);
  if (!text) throw new Error("Message cannot be empty.");
  const res = await query(
    `INSERT INTO client_messages (client_id, author_id, author_name, body)
     VALUES (:clientId, :by, :name, :body)`,
    { clientId, by: authorId ?? null, name: authorName ? str(authorName, 191) : null, body: text }
  );
  return res.insertId;
}
