import { requireClientApi, json } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { checklistDocKey, checklistPrefix, presignPutUrl, headObject, ensureFolder } from "@/lib/s3.js";
import { loadDraft } from "@/lib/onboarding.js";
import { getChecklistItemContext, attachChecklistDocument } from "@/lib/requests.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

async function ownedItem(itemId, clientId) {
  const ctx = await getChecklistItemContext(itemId);
  if (!ctx || ctx.client_id !== clientId) return null;
  if (!ctx.allow_upload) return { blocked: true };
  const [c] = await query("SELECT client_code FROM clients WHERE id = :id LIMIT 1", { id: clientId });
  if (!c) return null;
  const draft = await loadDraft(clientId);
  const facilityName = draft?.data?.facility?.facilityName || c.client_code;
  return { ...ctx, client_code: c.client_code, facilityName };
}

// POST — presign a client document upload against an upload-enabled item.
export async function POST(req, { params }) {
  const guard = await requireClientApi("dashboard");
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

  const item = await ownedItem(itemId, guard.clientId);
  if (!item) return json({ error: "Item not found." }, 404);
  if (item.blocked) return json({ error: "Uploads are not enabled for this item." }, 403);

  // Make sure the facility's checklist folder exists before the file lands.
  await ensureFolder(checklistPrefix(guard.clientId, item.client_code, item.facilityName));

  const key = checklistDocKey({
    clientId: guard.clientId,
    clientCode: item.client_code,
    facilityName: item.facilityName,
    requestId: item.request_id,
    source: "client",
    filename: String(body?.filename || "file"),
  });
  const { url, headers } = await presignPutUrl({ key, contentType: body?.content_type });
  return json({ ok: true, url, headers, key });
}

// PUT — confirm the client upload and record the document row.
export async function PUT(req, { params }) {
  const guard = await requireClientApi("dashboard");
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

  const item = await ownedItem(itemId, guard.clientId);
  if (!item) return json({ error: "Item not found." }, 404);
  if (item.blocked) return json({ error: "Uploads are not enabled for this item." }, 403);
  if (!key.includes(`/checklists/${item.request_id}/client/`)) {
    return json({ error: "Upload key does not match this item." }, 400);
  }
  const head = await headObject(key);
  if (!head) return json({ error: "Upload was not found in storage." }, 400);

  const id = await attachChecklistDocument(itemId, guard.clientId, {
    source: "client",
    s3_key: key,
    filename: String(body?.filename || "file"),
    size_bytes: head.size,
    content_type: head.contentType || body?.content_type || null,
    uploaded_by: guard.session.sub,
  });
  return json({ ok: true, id });
}
