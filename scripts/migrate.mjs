// Schema migration + super-admin bootstrap, run as a deploy step:
//
//   npm run migrate
//
// This used to run lazily on the first request to each new instance, costing
// ~6 remote round trips (~1.7s) before that request could be served. The routes
// no longer call it, so it MUST run on deploy whenever the schema changes —
// the app will not create its own tables any more.
//
// Idempotent: safe to run on every deploy, and safe to run twice.

// @next/env is CommonJS, so it has no named ESM exports — take the default.
import nextEnv from "@next/env";
import { ensureSchema, closePool } from "../src/lib/db.js";

// Load .env exactly the way `next` does, so the script and the app always agree
// on which database they are pointing at.
nextEnv.loadEnvConfig(process.cwd());

const started = Date.now();

try {
  await ensureSchema();
  console.log(`migrate: schema up to date in ${Date.now() - started}ms`);
} catch (err) {
  console.error(`migrate: FAILED after ${Date.now() - started}ms`);
  console.error(err?.message || err);
  // Fail the deploy rather than ship code against a schema that never applied.
  process.exitCode = 1;
} finally {
  // Without this the pool's idle connections keep the event loop alive and the
  // script never exits.
  await closePool().catch(() => {});
}
