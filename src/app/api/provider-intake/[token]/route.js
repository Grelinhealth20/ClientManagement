import { json } from "@/lib/auth.js";
import { loadDraft, upsertProviderInDraft } from "@/lib/onboarding.js";
import { resolveLink, isLinkActive, verifyCredential, needsSetup, markLinkUsed } from "@/lib/providerLinks.js";
import { query } from "@/lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resolve + authorize a link from its token and any accepted credential (the
// temp key, the provider's own security key, or their configured NPI).
async function authorize(token, credential) {
  const link = await resolveLink(token);
  if (!link) return { error: json({ error: "This link is not valid." }, 404) };
  if (!isLinkActive(link)) return { error: json({ error: "This link has expired or was revoked." }, 410) };
  const via = verifyCredential(link, credential);
  if (!via) return { error: json({ error: "Incorrect security key or NPI." }, 401) };
  return { link, via };
}

/** The provider slot this link points at (create a stable key if none set). */
function providerKeyFor(link) {
  return link.provider_key || `link-${link.id}`;
}

// GET /api/provider-intake/:token — pre-auth status for the unlock screen.
// Reveals only whether the link is usable and, if the provider has already
// configured return access, WHICH method (key vs NPI) — never any secret value.
// This lets the gate ask for just the security key on a first visit, and for
// "security key or NPI" only after the provider set that up.
export async function GET(_req, { params }) {
  const link = await resolveLink(params.token);
  if (!link) return json({ active: false, reason: "not_found" }, 404);
  if (!isLinkActive(link)) return json({ active: false, reason: "inactive" }, 410);
  return json({
    active: true,
    setupDone: !!link.auth_setup, // provider has configured return access
    authMethod: link.auth_method || null, // 'key' | 'npi' | null
  });
}

// POST /api/provider-intake/:token — verify the security key and return the
// facility context + this provider's current data so the external form loads.
export async function POST(req, { params }) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const auth = await authorize(params.token, body?.credential ?? body?.key);
  if (auth.error) return auth.error;
  const { link, via } = auth;

  await markLinkUsed(link.id);

  const draft = await loadDraft(link.client_id);
  const providers = Array.isArray(draft.data?.providers) ? draft.data.providers : [];
  const key = providerKeyFor(link);
  const provider = providers.find((p) => p.key === key) || { key };

  const [clientRow] = await query(
    "SELECT client_code, name FROM clients WHERE id = :id LIMIT 1",
    { id: link.client_id }
  );

  return json({
    ok: true,
    // If they unlocked with the temp key and haven't configured return-access
    // yet, the UI prompts them to set it up.
    needsSetup: via === "temp" && needsSetup(link),
    authMethod: link.auth_method || null,
    context: {
      clientCode: clientRow?.client_code || "",
      facilityName: draft.data?.facility?.facilityName || clientRow?.name || "",
      facilityNpi: link.facility_npi,
      label: link.label,
      providerKey: key,
    },
    provider,
  });
}

// PUT /api/provider-intake/:token — save the provider's own section back into
// the client's draft (tagged to the facility + client the link belongs to).
export async function PUT(req, { params }) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const auth = await authorize(params.token, body?.credential ?? body?.key);
  if (auth.error) return auth.error;
  const { link } = auth;

  const provider = body?.provider && typeof body.provider === "object" ? body.provider : {};
  const key = providerKeyFor(link);

  // Atomic single-provider merge — never overwrites the facility's other edits.
  await upsertProviderInDraft(link.client_id, key, { ...provider, _source: "external" });

  return json({ ok: true });
}
