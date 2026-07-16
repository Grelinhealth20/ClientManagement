import { getSession, json } from "@/lib/auth.js";
import { isMasterAdmin } from "@/lib/env.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return json({ authenticated: false }, 401);
  return json({
    authenticated: true,
    user: {
      id: session.sub,
      name: session.name,
      email: session.email,
      role: session.role,
      client_id: session.client_id,
      permissions: session.permissions || [],
      is_master: isMasterAdmin(session),
    },
  });
}
