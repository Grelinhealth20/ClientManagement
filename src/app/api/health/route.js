import { pingDb } from "@/lib/db.js";
import { json } from "@/lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health — unauthenticated liveness/readiness probe for load
// balancers and uptime monitors. Reports app + database reachability without
// leaking any configuration details.
export async function GET() {
  try {
    await pingDb();
    return json({ status: "ok", db: "up", time: new Date().toISOString() });
  } catch {
    return json({ status: "degraded", db: "down", time: new Date().toISOString() }, 503);
  }
}
