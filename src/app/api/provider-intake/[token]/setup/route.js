import { json } from "@/lib/auth.js";
import { resolveLink, isLinkActive, verifyCredential, setupProviderAuth } from "@/lib/providerLinks.js";
import { validateIndividualNpi } from "@/lib/nppes.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/provider-intake/:token/setup — after unlocking with the temp key,
// the provider chooses how they will return to this form:
//   { credential, method: "key", value }  → set their own security key
//   { credential, method: "npi", value }  → use their individual NPI (validated
//                                            against NPPES before it is accepted)
export async function POST(req, { params }) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const link = await resolveLink(params.token);
  if (!link) return json({ error: "This link is not valid." }, 404);
  if (!isLinkActive(link)) return json({ error: "This link has expired or was revoked." }, 410);
  // Must present a currently-valid credential (the temp key or an existing one).
  if (!verifyCredential(link, body?.credential ?? body?.key)) {
    return json({ error: "Please unlock the form first." }, 401);
  }

  const method = body?.method;
  const value = String(body?.value || "").trim();

  if (method === "key") {
    if (value.length < 6) return json({ error: "Your security key must be at least 6 characters." }, 400);
    await setupProviderAuth(link.id, { method: "key", key: value });
    return json({ ok: true, method: "key" });
  }

  if (method === "npi") {
    const result = await validateIndividualNpi(value);
    if (result.error) return json({ error: result.error }, 502);
    if (!result.valid) {
      return json({ error: "That NPI could not be verified as an individual provider in the registry." }, 400);
    }
    await setupProviderAuth(link.id, { method: "npi", npi: value });
    return json({ ok: true, method: "npi", providerName: result.name });
  }

  return json({ error: "Choose a valid return-access method." }, 400);
}
