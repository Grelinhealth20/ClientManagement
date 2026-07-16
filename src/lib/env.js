// ─────────────────────────────────────────────────────────────
// Centralized, validated environment configuration.
//
// Every module consumes config from here instead of reading process.env
// directly, so a misconfigured deployment fails fast with a single, clear,
// aggregated error — instead of surfacing as an empty signing key, a NaN
// session length, or a cryptic driver error deep inside a request.
//
// Validation is grouped and lazy: each getter validates only the variables
// its runtime needs (the Edge middleware only needs auth config; Node route
// handlers need DB + crypto), caches the frozen result, and is safe to import
// from both the Edge and Node.js runtimes (no Node-only APIs are used here).
// ─────────────────────────────────────────────────────────────

const HEX_64 = /^[0-9a-fA-F]{64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Values that clearly came from a template and must never silently ship.
const PLACEHOLDER_RE = /(change[_-]?me|your[_-]|example|placeholder|xxxx|<.+>)/i;

function isProd() {
  return process.env.NODE_ENV === "production";
}

// Read a trimmed variable (safe for hosts, names, secrets, keys).
function read(name) {
  const v = process.env[name];
  return v == null ? "" : String(v).trim();
}

// Read a raw variable without trimming — used for passwords, where leading or
// trailing whitespace can be significant.
function readRaw(name) {
  const v = process.env[name];
  return v == null ? "" : String(v);
}

function fail(scope, errors) {
  throw new Error(
    `Invalid environment configuration (${scope}):\n` +
      errors.map((e) => `  • ${e}`).join("\n") +
      `\nSet these in your environment (see .env.example) and restart.`
  );
}

function warn(message) {
  // eslint-disable-next-line no-console
  console.warn(`[env] WARNING: ${message}`);
}

function looksLikePlaceholder(value) {
  return PLACEHOLDER_RE.test(value);
}

// ── Auth (JWT + session) ─────────────────────────────────────
let _auth = null;
export function authConfig() {
  if (_auth) return _auth;
  const errors = [];

  const jwtSecret = read("JWT_SECRET");
  if (!jwtSecret) errors.push("JWT_SECRET is required.");
  else if (jwtSecret.length < 32) errors.push("JWT_SECRET must be at least 32 characters.");

  let sessionTtlHours = 12;
  const rawTtl = read("SESSION_TTL_HOURS");
  if (rawTtl) {
    const n = Number(rawTtl);
    if (!Number.isFinite(n) || n <= 0) {
      errors.push("SESSION_TTL_HOURS must be a positive number.");
    } else {
      sessionTtlHours = n;
    }
  }

  if (errors.length) fail("auth", errors);
  if (isProd() && looksLikePlaceholder(jwtSecret)) {
    warn("JWT_SECRET looks like a placeholder in production — rotate it.");
  }

  _auth = Object.freeze({ jwtSecret, sessionTtlHours });
  return _auth;
}

// ── Field encryption (AES-256-GCM) ───────────────────────────
let _crypto = null;
export function cryptoConfig() {
  if (_crypto) return _crypto;
  const errors = [];

  const encryptionKey = read("ENCRYPTION_KEY");
  if (!encryptionKey) errors.push("ENCRYPTION_KEY is required.");
  else if (!HEX_64.test(encryptionKey)) {
    errors.push("ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).");
  }

  if (errors.length) fail("crypto", errors);

  _crypto = Object.freeze({ encryptionKey });
  return _crypto;
}

// ── Database (MySQL) ─────────────────────────────────────────
let _db = null;
export function dbConfig() {
  if (_db) return _db;
  const errors = [];

  const host = read("DB_HOST");
  const user = read("DB_USER");
  const password = readRaw("DB_PASSWORD");
  const name = read("DB_NAME");
  if (!host) errors.push("DB_HOST is required.");
  if (!user) errors.push("DB_USER is required.");
  if (!name) errors.push("DB_NAME is required.");

  let port = 3306;
  const rawPort = read("DB_PORT");
  if (rawPort) {
    const n = Number(rawPort);
    if (!Number.isInteger(n) || n <= 0 || n > 65535) {
      errors.push("DB_PORT must be a valid TCP port (1-65535).");
    } else {
      port = n;
    }
  }

  let connectionLimit = 5;
  const rawLimit = read("DB_CONNECTION_LIMIT");
  if (rawLimit) {
    const n = Number(rawLimit);
    if (!Number.isInteger(n) || n <= 0) {
      errors.push("DB_CONNECTION_LIMIT must be a positive integer.");
    } else {
      connectionLimit = n;
    }
  }

  if (errors.length) fail("database", errors);

  _db = Object.freeze({ host, port, user, password, database: name, connectionLimit });
  return _db;
}

// ── Object storage (AWS S3) ──────────────────────────────────
let _s3 = null;
export function s3Config() {
  if (_s3) return _s3;
  const errors = [];

  const accessKeyId = read("AWS_ACCESS_KEY_ID");
  const secretAccessKey = readRaw("AWS_SECRET_ACCESS_KEY");
  const region = read("S3_REGION") || read("AWS_REGION");
  const bucket = read("S3_BUCKET");

  if (!accessKeyId) errors.push("AWS_ACCESS_KEY_ID is required.");
  if (!secretAccessKey) errors.push("AWS_SECRET_ACCESS_KEY is required.");
  if (!region) errors.push("S3_REGION is required.");
  if (!bucket) errors.push("S3_BUCKET is required.");

  if (errors.length) fail("s3", errors);

  _s3 = Object.freeze({ accessKeyId, secretAccessKey, region, bucket });
  return _s3;
}

// The single master admin — the only account allowed to permanently delete a
// client (and everything belonging to it). Defaults to SUPER_ADMIN_EMAIL, and
// can be overridden with MASTER_ADMIN_EMAIL.
export function masterAdminEmail() {
  return (read("MASTER_ADMIN_EMAIL") || read("SUPER_ADMIN_EMAIL")).toLowerCase();
}

export function isMasterAdmin(session) {
  const master = masterAdminEmail();
  return !!master && String(session?.email || "").toLowerCase() === master;
}

// ── Bootstrap super admin (optional seed) ────────────────────
let _bootstrap = null;
export function bootstrapConfig() {
  if (_bootstrap) return _bootstrap;
  const errors = [];

  const email = read("SUPER_ADMIN_EMAIL").toLowerCase();
  const password = readRaw("SUPER_ADMIN_PASSWORD");
  const name = read("SUPER_ADMIN_NAME") || "Super Admin";

  // Seeding is optional: it only runs when both email and password are set.
  // If either is provided, validate the pair so a typo can't create a broken
  // or unreachable admin account.
  if (email && !EMAIL_RE.test(email)) errors.push("SUPER_ADMIN_EMAIL must be a valid email.");
  if (email && password && password.length < 8) {
    errors.push("SUPER_ADMIN_PASSWORD must be at least 8 characters.");
  }

  if (errors.length) fail("bootstrap", errors);

  const enabled = Boolean(email && password);
  if (enabled && isProd() && looksLikePlaceholder(password)) {
    warn("SUPER_ADMIN_PASSWORD looks like a default — change it immediately after first login.");
  }

  _bootstrap = Object.freeze({ enabled, email, password, name });
  return _bootstrap;
}
