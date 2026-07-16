import { requireClientApi, json } from "@/lib/auth.js";
import { searchOrganizations } from "@/lib/nppes.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/onboarding/nppes?name=<facility name>
// Server-side proxy to the CMS NPPES NPI Registry. Returns ranked organization
// matches so the facility form can auto-fill from real registry data.
export async function GET(req) {
  const guard = await requireClientApi("onboarding");
  if (guard.error) return guard.error;

  const { searchParams } = new URL(req.url);
  const name = String(searchParams.get("name") || "").trim();
  if (name.length < 3) return json({ matches: [] });

  const { matches, error } = await searchOrganizations(name);
  return json({ matches, error: error || null });
}
