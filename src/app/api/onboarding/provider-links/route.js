import { requireClientApi, json, clientIp } from "@/lib/auth.js";
import { query, writeAudit } from "@/lib/db.js";
import { loadDraft } from "@/lib/onboarding.js";
import { createProviderLink, listProviderLinks } from "@/lib/providerLinks.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/onboarding/provider-links — active links for this client.
export async function GET() {
  const guard = await requireClientApi("onboarding");
  if (guard.error) return guard.error;
  return json({ links: await listProviderLinks(guard.clientId) });
}

// POST /api/onboarding/provider-links — mint a link + security key for a
// provider slot. Returns the token/key ONCE so the client can share them.
export async function POST(req) {
  const guard = await requireClientApi("onboarding");
  if (guard.error) return guard.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const providerKey = body?.provider_key ? String(body.provider_key).trim() : null;
  const label = body?.label ? String(body.label).trim() : null;

  // Tag the link with this client's facility NPI so external submissions are
  // bound to the right facility.
  const draft = await loadDraft(guard.clientId);
  const facilityNpi = draft?.data?.facility?.groupNPI || null;

  const link = await createProviderLink({
    clientId: guard.clientId,
    facilityNpi,
    providerKey,
    label,
    createdBy: guard.session.sub,
  });

  await writeAudit({
    actorId: guard.session.sub,
    actorEmail: guard.session.email,
    action: "provider_link_created",
    entity: "provider_access_link",
    entityId: link.id,
    meta: { clientId: guard.clientId, provider_key: providerKey },
    ip: clientIp(req),
  });

  // The path is returned; the client component turns it into an absolute URL
  // using its own origin.
  return json(
    {
      ok: true,
      id: link.id,
      token: link.token,
      security_key: link.key,
      path: `/provider-intake/${link.token}`,
      expires_at: link.expiresAt,
    },
    201
  );
}
