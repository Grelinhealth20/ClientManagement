import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/jwt.js";

// Coarse-grained route protection at the edge. Fine-grained role checks
// also happen in every API route + server page.
export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  const isAdmin = pathname.startsWith("/admin");
  const isDash = pathname.startsWith("/dashboard");

  if (isAdmin || isDash) {
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (isAdmin && session.role !== "super_admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    if (isDash && session.role === "super_admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  // Authenticated users hitting /login get sent to their home.
  if (pathname === "/login" && session) {
    const url = req.nextUrl.clone();
    url.pathname = session.role === "super_admin" ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/admin/:path*", "/dashboard/:path*"],
};
