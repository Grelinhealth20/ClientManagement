import { requireClientApi, json } from "@/lib/auth.js";
import { loadDraft, saveDraft, patchDraft, listDocuments } from "@/lib/onboarding.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/onboarding — load this client's saved draft + document manifest, so
// the wizard can rehydrate exactly where the user left off (even across logout).
export async function GET() {
  const guard = await requireClientApi("onboarding");
  if (guard.error) return guard.error;

  const [draft, documents] = await Promise.all([
    loadDraft(guard.clientId),
    listDocuments(guard.clientId),
  ]);

  return json({
    draft: {
      current_step: draft.current_step,
      status: draft.status,
      data: draft.data,
      reference_code: draft.reference_code,
      updated_at: draft.updated_at,
    },
    documents,
  });
}

// PUT /api/onboarding — autosave the whole wizard state.
export async function PUT(req) {
  const guard = await requireClientApi("onboarding");
  if (guard.error) return guard.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const current_step = Number(body?.current_step) || 1;
  // Prefer a partial `patch` (merged atomically per top-level section, so
  // concurrent editors don't clobber each other). Fall back to a full `data`
  // replace for any legacy caller.
  const patch = body?.patch && typeof body.patch === "object" ? body.patch : null;
  const data = body?.data && typeof body.data === "object" ? body.data : null;

  try {
    const result = patch
      ? await patchDraft(guard.clientId, { patch, current_step })
      : await saveDraft(guard.clientId, { data: data || {}, current_step });
    return json({ ok: true, updated_at: result.updated_at });
  } catch (err) {
    if (err?.code === "DRAFT_TOO_LARGE") {
      return json({ error: "This form is too large to save. Please remove some content." }, 413);
    }
    throw err;
  }
}
