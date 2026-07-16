import { requireClientApi, json, clientIp } from "@/lib/auth.js";
import { approveOnboarding } from "@/lib/onboarding.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/onboarding/submit — final approval. Allocates the unique 16-digit
// reference, stores the immutable snapshot, and marks the draft approved.
export async function POST(req) {
  const guard = await requireClientApi("onboarding");
  if (guard.error) return guard.error;

  const { reference_code, alreadyApproved } = await approveOnboarding(guard.clientId, {
    approvedBy: guard.session.sub,
    approvedEmail: guard.session.email,
  });

  return json({ ok: true, reference_code, alreadyApproved });
}
