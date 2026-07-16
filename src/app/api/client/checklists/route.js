import { requireClientApi, json } from "@/lib/auth.js";
import { listChecklists } from "@/lib/requests.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/client/checklists — checklist requests Grelin Health sent this client.
export async function GET() {
  const guard = await requireClientApi("dashboard");
  if (guard.error) return guard.error;
  return json({ checklists: await listChecklists(guard.clientId) });
}
