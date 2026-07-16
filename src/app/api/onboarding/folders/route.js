import { requireClientApi, json } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { loadDraft } from "@/lib/onboarding.js";
import { facilityPrefix, providerPrefix, ensureFolder } from "@/lib/s3.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/onboarding/folders — automatically create the S3 folder for the
// facility or a provider. Body: { scope: "facility" | "provider", providerName? }.
// The facility name is read from the client's own draft so the folder always
// matches where documents will be stored.
export async function POST(req) {
  const guard = await requireClientApi("onboarding");
  if (guard.error) return guard.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const scope = body?.scope === "provider" ? "provider" : "facility";
  const providerKey = body?.provider_key ? String(body.provider_key).trim() : "";

  const [clientRow] = await query("SELECT client_code FROM clients WHERE id = :id LIMIT 1", {
    id: guard.clientId,
  });
  if (!clientRow) return json({ error: "Client not found." }, 404);

  const draft = await loadDraft(guard.clientId);
  const facilityName = draft?.data?.facility?.facilityName || clientRow.client_code;

  if (scope === "provider" && !providerKey) {
    return json({ error: "A provider is required to create its folder." }, 400);
  }

  const prefix =
    scope === "provider"
      ? providerPrefix(guard.clientId, clientRow.client_code, facilityName, providerKey)
      : facilityPrefix(guard.clientId, clientRow.client_code, facilityName);

  const created = await ensureFolder(prefix);

  return json({ ok: true, scope, prefix: created });
}
