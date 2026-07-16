import { requireClientApi, json } from "@/lib/auth.js";
import { listEnrollment } from "@/lib/requests.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/client/enrollment — read-only enrollment status for this client,
// split into facility payers and provider payers.
export async function GET() {
  const guard = await requireClientApi("dashboard");
  if (guard.error) return guard.error;
  const all = await listEnrollment(guard.clientId);
  return json({
    facility: all.filter((p) => p.scope === "facility"),
    provider: all.filter((p) => p.scope === "provider"),
  });
}
