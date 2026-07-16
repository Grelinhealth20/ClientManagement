/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Isolate the dev server's build cache from production builds.
  //
  // `next dev`, `next build` and `next start` all use `.next` by default, so
  // running a build while the local dev server is up overwrites the dev
  // server's webpack chunks. The running server then 500s with
  // "Cannot find module './NNN.js'" (from .next/server/webpack-runtime.js) and
  // the browser shows a blank white page until `.next` is cleared and dev is
  // restarted.
  //
  // Giving development its own directory makes that collision impossible.
  // `next build`/`next start`/Vercel all run with NODE_ENV=production and keep
  // using `.next`, so the deployment output path is unchanged.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  // mysql2 / bcryptjs are node dependencies — keep them external to the serverless bundle
  experimental: {
    serverComponentsExternalPackages: ["mysql2", "bcryptjs"],
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";

    // Content-Security-Policy tuned for Next.js + Framer Motion. The App Router
    // ships inline bootstrap/hydration scripts, so 'unsafe-inline' is required.
    // In DEVELOPMENT, Next compiles client modules via eval() and serves HMR
    // over a websocket, so we must additionally allow 'unsafe-eval' and ws:.
    // Production keeps the stricter policy (no eval).
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";
    const connectSrc = isDev
      ? "connect-src 'self' ws: wss:"
      : "connect-src 'self'";

    const directives = [
      "default-src 'self'",
      "base-uri 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      scriptSrc,
      connectSrc,
      "font-src 'self' data:",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ];
    // Only force HTTPS upgrades in production — on localhost http it breaks dev.
    if (!isDev) directives.push("upgrade-insecure-requests");

    const csp = directives.join("; ");

    const securityHeaders = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    // HSTS is meaningful only over HTTPS; omit it in local dev.
    if (!isDev) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
