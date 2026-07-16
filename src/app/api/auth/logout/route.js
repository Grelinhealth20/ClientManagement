import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/jwt.js";
import { json } from "@/lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  cookies().set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return json({ ok: true });
}
