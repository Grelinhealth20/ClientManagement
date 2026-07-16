import { requireClientApi, json } from "@/lib/auth.js";
import { listMessages, postMessage } from "@/lib/requests.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/client/messages — the intra-client message board. Scoped strictly to
// the caller's own client_id, so users can only ever see their own org's thread.
export async function GET() {
  const guard = await requireClientApi("dashboard");
  if (guard.error) return guard.error;
  return json({ messages: await listMessages(guard.clientId), me: guard.session.sub });
}

// POST /api/client/messages — post a message to the caller's own client thread.
export async function POST(req) {
  const guard = await requireClientApi("dashboard");
  if (guard.error) return guard.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (!String(body?.body || "").trim()) return json({ error: "Message cannot be empty." }, 400);

  try {
    const id = await postMessage(guard.clientId, {
      authorId: guard.session.sub,
      authorName: guard.session.name || guard.session.email,
      body: body.body,
    });
    return json({ ok: true, id });
  } catch (e) {
    return json({ error: e.message || "Could not post the message." }, 400);
  }
}
