import { query } from "./db.js";

// ─────────────────────────────────────────────────────────────
// Login brute-force protection.
//
// Serverless functions don't share memory, so an in-process counter would be
// trivially bypassed by hitting a different warm instance. Instead we count
// recent `login_failed` rows already written to the immutable audit_log —
// durable, shared across all instances, and free of extra infrastructure.
//
// A lockout is scoped to the (email, window) pair so a single account under
// attack is throttled without letting one attacker lock out unrelated users.
// ─────────────────────────────────────────────────────────────

// Trusted integer constants (never user input) — safe to inline into SQL.
const MAX_FAILURES = 10; // failed attempts allowed within the window
const WINDOW_MINUTES = 15; // rolling window length

/**
 * Returns { limited: boolean, retryAfterSeconds: number }.
 * Fails open (never blocks a legitimate login) if the audit query errors —
 * availability of the login path takes priority over the rate limit.
 */
export async function checkLoginRate(email) {
  if (!email) return { limited: false, retryAfterSeconds: 0 };
  try {
    const rows = await query(
      `SELECT COUNT(*) AS failures
         FROM audit_log
        WHERE action = 'login_failed'
          AND actor_email = :email
          AND created_at > (NOW() - INTERVAL ${WINDOW_MINUTES} MINUTE)`,
      { email }
    );
    const failures = Number(rows?.[0]?.failures || 0);
    if (failures >= MAX_FAILURES) {
      return { limited: true, retryAfterSeconds: WINDOW_MINUTES * 60 };
    }
    return { limited: false, retryAfterSeconds: 0 };
  } catch {
    return { limited: false, retryAfterSeconds: 0 };
  }
}
