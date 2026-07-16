import { requireApi, json } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { checklistDocKey, checklistPrefix, presignPutUrl, headObject, ensureFolder } from "@/lib/s3.js";
import { loadDraft } from "@/lib/onboarding.js";
import { getChecklistItemContext, attachChecklistDocument } from "@/lib/requests.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

async function ctxFor(itemId) {
  const ctx = await getChecklistItemContext(itemId);
  if (!ctx) return null;
  const [c] = await query("SELECT client_code FROM clients WHERE id = :id LIMIT 1", { id: ctx.client_id });
  if (!c) return null;
  // The facility name (from the client's draft) determines the facility folder
  // the checklist documents are filed under — same folder as onboarding docs.
  const draft = await loadDraft(ctx.client_id);
  const facilityName = draft?.data?.facility?.facilityName || c.client_code;
  return { ...ctx, client_code: c.client_code, facilityName };
}

// POST — presign an admin document upload (a file the client may then download).
export async function POST(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;
  const itemId = Number(params.itemId);
  if (!Number.isInteger(itemId)) return json({ error: "Invalid item id." }, 400);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const size = Number(body?.size) || 0;
  if (size > MAX_BYTES) return json({ error: "File exceeds the 25 MB limit." }, 413);

  const ctx = await ctxFor(itemId);
  if (!ctx) return json({ error: "Checklist item not found." }, 404);

  // Make sure the facility's checklist folder exists before the file lands.
  await ensureFolder(checklistPrefix(ctx.client_id, ctx.client_code, ctx.facilityName));

  const key = checklistDocKey({
    clientId: ctx.client_id,
    clientCode: ctx.client_code,
    facilityName: ctx.facilityName,
    requestId: ctx.request_id,
    source: "admin",
    filename: String(body?.filename || "file"),
  });
  const { url, headers } = await presignPutUrl({ key, contentType: body?.content_type });
  return json({ ok: true, url, headers, key });
}

// PUT — confirm the upload landed in S3 and record the document row.
export async function PUT(req, { params }) {
  const guard = await requireApi({ role: "super_admin" });
  if (guard.error) return guard.error;
  const itemId = Number(params.itemId);
  if (!Number.isInteger(itemId)) return json({ error: "Invalid item id." }, 400);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const key = String(body?.key || "");
  if (!key) return json({ error: "Missing upload key." }, 400);

  const ctx = await ctxFor(itemId);
  if (!ctx) return json({ error: "Checklist item not found." }, 404);
  // The key must sit under this client's prefix — never trust a client-supplied key.
  if (!key.includes(`/checklists/${ctx.request_id}/admin/`)) {
    return json({ error: "Upload key does not match this item." }, 400);
  }
  const head = await headObject(key);
  if (!head) return json({ error: "Upload was not found in storage." }, 400);

  const id = await attachChecklistDocument(itemId, ctx.client_id, {
    source: "admin",
    s3_key: key,
    filename: String(body?.filename || "file"),
    size_bytes: head.size,
    content_type: head.contentType || body?.content_type || null,
    uploaded_by: guard.session.sub,
  });
  return json({ ok: true, id });
}
