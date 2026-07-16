import mysql from "mysql2/promise";
import { dbConfig, bootstrapConfig } from "./env.js";

// ─────────────────────────────────────────────────────────────
// Connection pool (singleton across serverless invocations).
// In serverless we keep the pool on globalThis so warm lambdas reuse it.
// The pool is created lazily on first use so environment validation runs at
// request time (with a clear error) rather than crashing the build import.
// ─────────────────────────────────────────────────────────────
function createPool() {
  const cfg = dbConfig();
  return mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    waitForConnections: true,
    connectionLimit: cfg.connectionLimit,
    maxIdle: cfg.connectionLimit,
    idleTimeout: 30000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 15000,
    namedPlaceholders: true,
    charset: "utf8mb4",
    // DATETIME columns carry no zone. Without this, mysql2 interprets them in
    // whatever timezone the Node process happens to run in — UTC on Vercel, but
    // the developer's local zone elsewhere — so the same row would decode to
    // different instants depending on where the code runs, and "5 minutes ago"
    // would read as "4 hours ago" locally. This server's clock is UTC (NOW()
    // and UTC_TIMESTAMP() agree), so decode them as UTC everywhere.
    timezone: "Z",
  });
}

const globalForDb = globalThis;

/**
 * The process-wide pool, created on first use.
 *
 * Connection lifecycle, deliberately:
 *
 * - Opening/closing a connection per request would cost a TCP + MySQL handshake
 *   every time (~944ms measured against this remote host). The pool is opened
 *   once per process and reused instead.
 * - Nothing calls closePool() on the request path. In serverless the instance is
 *   frozen between invocations and thawed for the next one, so a pool closed
 *   after a response would have to be rebuilt — handshake and all — on the next
 *   request. Keeping it on globalThis is what lets a warm instance skip that.
 * - Individual connections are still acquired and released per unit of work:
 *   query() borrows one per call via pool.execute(), and withTransaction()
 *   holds exactly one for the life of the transaction and always gives it back.
 * - The OS reclaims the sockets when the process exits, and mysql2 retires idle
 *   connections after idleTimeout, so a long-lived process does not leak them.
 */
export function getPool() {
  if (!globalForDb.__grelinPool) globalForDb.__grelinPool = createPool();
  return globalForDb.__grelinPool;
}

/**
 * Close the pool and every connection in it.
 *
 * For short-lived processes — scripts, migrations, tests — where an open pool
 * would keep the event loop alive and hang the process after the work is done.
 * Do NOT call this from a request handler: it would tear the pool out from
 * under any concurrent request on the same instance.
 *
 * Safe to call more than once, and safe to call when no pool was ever created.
 */
export async function closePool() {
  const pool = globalForDb.__grelinPool;
  if (!pool) return;
  // Cleared first so a caller that reaches for the pool during shutdown builds a
  // fresh one rather than getting the half-closed instance.
  globalForDb.__grelinPool = null;
  await pool.end();
}

// Connection-level errors that mean "the socket died" — safe to retry on a
// fresh pooled connection. Common with remote MySQL behind a NAT/firewall that
// silently drops idle TCP connections.
const TRANSIENT_CODES = new Set([
  "ECONNRESET",
  "PROTOCOL_CONNECTION_LOST",
  "EPIPE",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EHOSTUNREACH",
]);

function isTransient(err) {
  return err && (TRANSIENT_CODES.has(err.code) || err.fatal === true);
}

// Run a DB operation, retrying once if the pool handed us a dead connection.
async function withRetry(run, attempts = 2) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await run();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1 || !isTransient(err)) throw err;
      // The failed connection is destroyed by mysql2; the next call acquires a
      // fresh one. Small backoff to avoid hammering a briefly-unavailable host.
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  throw lastErr;
}

/**
 * Thin query helper. Returns rows for SELECT, ResultSetHeader otherwise.
 */
export async function query(sql, params = {}) {
  const [rows] = await withRetry(() => getPool().execute(sql, params));
  return rows;
}

/**
 * Run `run` inside a transaction on a single pooled connection.
 *
 * `query()` takes an arbitrary connection from the pool per call, so a
 * multi-statement unit of work cannot be made atomic with it — BEGIN and INSERT
 * could land on different connections. Callers get a `tx(sql, params)` helper
 * bound to the one connection holding the transaction.
 *
 * Rolls back and rethrows on any error. Not retried: replaying a partially
 * applied transaction is not safe in general.
 */
export async function withTransaction(run) {
  // Acquired outside the try: if this throws there is no connection to release,
  // and a finally would blow up on `conn` being undefined.
  const conn = await getPool().getConnection();

  // A connection whose socket died, or whose rollback failed, may still be
  // mid-transaction or unusable. Returning it to the pool would hand the next
  // caller an open transaction; it must be destroyed instead.
  let poisoned = false;

  try {
    await conn.beginTransaction();
    const tx = async (sql, params = {}) => {
      const [rows] = await conn.execute(sql, params);
      return rows;
    };
    const result = await run(tx);
    await conn.commit();
    return result;
  } catch (err) {
    if (isTransient(err)) {
      // The socket is already gone — rolling back would only throw, and the
      // server has discarded the transaction anyway.
      poisoned = true;
    } else {
      try {
        await conn.rollback();
      } catch {
        // A rollback failure must not mask the original error, but it does mean
        // this connection's state is unknown.
        poisoned = true;
      }
    }
    throw err;
  } finally {
    // destroy() removes it from the pool and opens a fresh one on next demand;
    // release() returns it for reuse.
    if (poisoned) conn.destroy();
    else conn.release();
  }
}

/**
 * Liveness probe for health checks — resolves if the DB is reachable.
 */
export async function pingDb() {
  await withRetry(() => getPool().query("SELECT 1"));
  return true;
}

// ─────────────────────────────────────────────────────────────
// Schema migration + bootstrap. Idempotent, cached per process so
// it only runs once per warm lambda.
// ─────────────────────────────────────────────────────────────
let initPromise = null;

export function ensureSchema() {
  if (!initPromise) {
    // Retry the whole migration once on a transient disconnect, and — crucially
    // — do NOT cache a rejected promise. A single DB blip must not permanently
    // brick every future request; clear the cache so the next call can retry.
    initPromise = withRetry(() => runMigrations()).catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

async function indexExists(table, indexName) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
      LIMIT 1`,
    [table, indexName]
  );
  return rows.length > 0;
}

async function columnExists(table, column) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
      LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function runMigrations() {
  const pool = getPool();
  // clients — the organizations we onboard
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      name          VARCHAR(191) NOT NULL,
      company       VARCHAR(191) NULL,
      email         VARCHAR(191) NOT NULL,
      phone_enc     TEXT NULL,
      status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
      notes         TEXT NULL,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_clients_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // users — both super admins and client users
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      client_id      INT NULL,
      name           VARCHAR(191) NOT NULL,
      email          VARCHAR(191) NOT NULL,
      password_hash  VARCHAR(255) NOT NULL,
      role           ENUM('super_admin','client_user') NOT NULL DEFAULT 'client_user',
      permissions    JSON NULL,
      is_restricted  TINYINT(1) NOT NULL DEFAULT 0,
      last_login_at  DATETIME NULL,
      created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_users_email (email),
      KEY idx_users_client (client_id),
      CONSTRAINT fk_users_client FOREIGN KEY (client_id)
        REFERENCES clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Additive column migrations (idempotent) — safe to run on existing DBs.
  // must_reset_password forces a first-login password reset for client users.
  if (!(await columnExists("users", "must_reset_password"))) {
    await pool.query(
      `ALTER TABLE users
         ADD COLUMN must_reset_password TINYINT(1) NOT NULL DEFAULT 0 AFTER is_restricted`
    );
  }

  await migrateClientProfile(pool);
  await migrateUsernameScope(pool);

  // audit_log — immutable trail of privileged actions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id          BIGINT AUTO_INCREMENT PRIMARY KEY,
      actor_id    INT NULL,
      actor_email VARCHAR(191) NULL,
      action      VARCHAR(80) NOT NULL,
      entity      VARCHAR(80) NOT NULL,
      entity_id   VARCHAR(80) NULL,
      meta        JSON NULL,
      ip          VARCHAR(64) NULL,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_audit_entity (entity, entity_id),
      KEY idx_audit_actor (actor_id),
      KEY idx_audit_login_rate (action, actor_email, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Every login attempt appends to audit_log, and checkLoginRate() counts recent
  // failures on (action, actor_email, created_at) on the critical path of every
  // login. Without this index that COUNT is a full scan, so login latency would
  // grow with the size of the audit trail. Added here for databases created
  // before the index was part of the CREATE TABLE above.
  if (!(await indexExists("audit_log", "idx_audit_login_rate"))) {
    await pool.query(
      "ALTER TABLE audit_log ADD KEY idx_audit_login_rate (action, actor_email, created_at)"
    );
  }

  await migrateOnboarding(pool);
  await migrateRequests(pool);

  await bootstrapSuperAdmin();
}

// ── Onboarding workspace ─────────────────────────────────────
// The multi-step onboarding wizard (Facility → Providers → System/Payer Access
// → Review). Every row is scoped by client_id so a client's data is isolated
// and can be fetched as a group. The in-progress form state is autosaved as an
// encrypted blob so a user can log out mid-flow and resume exactly where they
// left off; uploaded files live in S3 with one row per document here.
async function migrateOnboarding(pool) {
  // One autosave draft per client. `data_enc` is the AES-256-GCM encrypted JSON
  // of the whole wizard state (it holds portal passwords, so it is never stored
  // in the clear).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS onboarding_drafts (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      client_id      INT NOT NULL,
      current_step   TINYINT NOT NULL DEFAULT 1,
      status         ENUM('in_progress','submitted','approved') NOT NULL DEFAULT 'in_progress',
      data_enc       LONGTEXT NULL,
      reference_code CHAR(16) NULL,
      submitted_at   DATETIME NULL,
      approved_at    DATETIME NULL,
      created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_onboarding_client (client_id),
      CONSTRAINT fk_onboarding_client FOREIGN KEY (client_id)
        REFERENCES clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // One row per uploaded document. Facility documents have scope='facility';
  // provider documents carry the provider_key that ties them to a provider in
  // the draft (and, once approved, to a normalized provider row).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS onboarding_documents (
      id            BIGINT AUTO_INCREMENT PRIMARY KEY,
      client_id     INT NOT NULL,
      scope         ENUM('facility','provider') NOT NULL DEFAULT 'facility',
      provider_key  VARCHAR(64) NULL,
      category      VARCHAR(120) NOT NULL,
      doc_type      VARCHAR(191) NOT NULL,
      s3_bucket     VARCHAR(191) NOT NULL,
      s3_key        VARCHAR(700) NOT NULL,
      filename      VARCHAR(255) NOT NULL,
      size_bytes    BIGINT NOT NULL DEFAULT 0,
      content_type  VARCHAR(191) NULL,
      uploaded_by   INT NULL,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_docs_client (client_id, scope, provider_key),
      CONSTRAINT fk_docs_client FOREIGN KEY (client_id)
        REFERENCES clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Immutable record written when a client's onboarding is finally approved,
  // carrying the unique 16-digit reference. The snapshot is the encrypted full
  // form + document manifest as it stood at approval.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS onboarding_submissions (
      id              BIGINT AUTO_INCREMENT PRIMARY KEY,
      client_id       INT NOT NULL,
      reference_code  CHAR(16) NOT NULL,
      snapshot_enc    LONGTEXT NULL,
      approved_by     INT NULL,
      approved_email  VARCHAR(191) NULL,
      created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_submission_ref (reference_code),
      KEY idx_submission_client (client_id),
      CONSTRAINT fk_submission_client FOREIGN KEY (client_id)
        REFERENCES clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Tokenized links so a facility can invite a provider to fill in their own
  // section externally. Only a SHA-256 hash of the token is stored; the raw
  // token lives only in the shared URL.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS provider_access_links (
      id            BIGINT AUTO_INCREMENT PRIMARY KEY,
      client_id     INT NOT NULL,
      facility_npi  VARCHAR(20) NULL,
      provider_key  VARCHAR(64) NULL,
      token_hash    CHAR(64) NOT NULL,
      key_hash      CHAR(64) NULL,
      label         VARCHAR(191) NULL,
      expires_at    DATETIME NULL,
      used_at       DATETIME NULL,
      revoked_at    DATETIME NULL,
      created_by    INT NULL,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_link_token (token_hash),
      KEY idx_link_client (client_id),
      CONSTRAINT fk_link_client FOREIGN KEY (client_id)
        REFERENCES clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Additive: the security key hash for links created before the column existed.
  if (!(await columnExists("provider_access_links", "key_hash"))) {
    await pool.query(
      "ALTER TABLE provider_access_links ADD COLUMN key_hash CHAR(64) NULL AFTER token_hash"
    );
  }

  // Provider self-service return access: after the first temp-key access the
  // provider chooses how they'll return — their own security key, or their
  // individual NPI (validated against NPPES). These columns hold that choice.
  const linkCols = [
    ["auth_setup", "TINYINT(1) NOT NULL DEFAULT 0 AFTER key_hash"],
    ["auth_method", "VARCHAR(8) NULL AFTER auth_setup"], // 'key' | 'npi'
    ["provider_key_hash", "CHAR(64) NULL AFTER auth_method"],
    ["provider_npi", "VARCHAR(20) NULL AFTER provider_key_hash"],
  ];
  for (const [name, def] of linkCols) {
    if (!(await columnExists("provider_access_links", name))) {
      await pool.query(`ALTER TABLE provider_access_links ADD COLUMN ${name} ${def}`);
    }
  }
}

// ── Client Requests & Enrollment module ─────────────────────────────────────
// A self-contained set of tables powering: checklist requests (super admin asks
// a client for requirements, with per-item upload/download grants), payer
// enrollment tracking (facility + individual providers, with follow-up notes),
// client support tickets (Request from Client, with threaded responses), and
// intra-client messaging. Every table is scoped by client_id and cascades on
// client delete so tenant isolation and the master-admin wipe both hold.
async function migrateRequests(pool) {
  // A checklist request: one detailed ask from a super admin to a client,
  // composed of one or more items. Moves to 'completed' when every item is done.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS checklist_requests (
      id            BIGINT AUTO_INCREMENT PRIMARY KEY,
      client_id     INT NOT NULL,
      title         VARCHAR(191) NOT NULL,
      message       TEXT NULL,
      status        ENUM('pending','completed') NOT NULL DEFAULT 'pending',
      created_by    INT NULL,
      created_email VARCHAR(191) NULL,
      completed_at  DATETIME NULL,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_checklist_client (client_id, status),
      CONSTRAINT fk_checklist_client FOREIGN KEY (client_id)
        REFERENCES clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // One item within a checklist. allow_upload lets the client attach files
  // (drag & drop appears on their end); allow_download exposes any admin-attached
  // document for the client to download. is_completed drives the completed queue.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS checklist_items (
      id            BIGINT AUTO_INCREMENT PRIMARY KEY,
      request_id    BIGINT NOT NULL,
      content       TEXT NOT NULL,
      allow_upload  TINYINT(1) NOT NULL DEFAULT 0,
      allow_download TINYINT(1) NOT NULL DEFAULT 0,
      is_completed  TINYINT(1) NOT NULL DEFAULT 0,
      completed_at  DATETIME NULL,
      sort_order    INT NOT NULL DEFAULT 0,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_item_request (request_id),
      CONSTRAINT fk_item_request FOREIGN KEY (request_id)
        REFERENCES checklist_requests(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Documents attached to a checklist item. source='admin' → uploaded by the
  // super admin for the client to download; source='client' → uploaded by the
  // client against an upload-enabled item. client_id is denormalised for a fast
  // ownership check without joining back through the request.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS checklist_documents (
      id            BIGINT AUTO_INCREMENT PRIMARY KEY,
      item_id       BIGINT NOT NULL,
      client_id     INT NOT NULL,
      source        ENUM('admin','client') NOT NULL,
      s3_bucket     VARCHAR(191) NOT NULL,
      s3_key        VARCHAR(700) NOT NULL,
      filename      VARCHAR(255) NOT NULL,
      size_bytes    BIGINT NOT NULL DEFAULT 0,
      content_type  VARCHAR(191) NULL,
      uploaded_by   INT NULL,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_cdoc_item (item_id),
      CONSTRAINT fk_cdoc_item FOREIGN KEY (item_id)
        REFERENCES checklist_items(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // A payer enrollment row. scope='facility' applies to the whole facility;
  // scope='provider' is tied to one provider (provider_key + display name).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS enrollment_payers (
      id            BIGINT AUTO_INCREMENT PRIMARY KEY,
      client_id     INT NOT NULL,
      scope         ENUM('facility','provider') NOT NULL,
      provider_key  VARCHAR(64) NULL,
      provider_name VARCHAR(191) NULL,
      payer_name    VARCHAR(191) NOT NULL,
      status        VARCHAR(32) NOT NULL DEFAULT 'not_started',
      start_date    DATE NULL,
      notes         TEXT NULL,
      created_by    INT NULL,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_payer_client (client_id, scope),
      CONSTRAINT fk_payer_client FOREIGN KEY (client_id)
        REFERENCES clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Time-stamped follow-up notes attached to a payer enrollment row.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS enrollment_followups (
      id            BIGINT AUTO_INCREMENT PRIMARY KEY,
      payer_id      BIGINT NOT NULL,
      note          TEXT NOT NULL,
      created_by    INT NULL,
      created_email VARCHAR(191) NULL,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_followup_payer (payer_id),
      CONSTRAINT fk_followup_payer FOREIGN KEY (payer_id)
        REFERENCES enrollment_payers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Support tickets raised by a client (Request from Client). ticket_code is the
  // human-facing unique id (e.g. GH-4F2A9C). categories is a JSON array.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_tickets (
      id            BIGINT AUTO_INCREMENT PRIMARY KEY,
      client_id     INT NOT NULL,
      ticket_code   VARCHAR(24) NOT NULL,
      subject       VARCHAR(191) NOT NULL,
      categories    JSON NULL,
      details       TEXT NULL,
      status        ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
      created_by    INT NULL,
      created_name  VARCHAR(191) NULL,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_ticket_code (ticket_code),
      KEY idx_ticket_client (client_id, status),
      CONSTRAINT fk_ticket_client FOREIGN KEY (client_id)
        REFERENCES clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Threaded responses on a ticket — from the super admin or a client user.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_responses (
      id            BIGINT AUTO_INCREMENT PRIMARY KEY,
      ticket_id     BIGINT NOT NULL,
      author_type   ENUM('super_admin','client_user') NOT NULL,
      author_id     INT NULL,
      author_name   VARCHAR(191) NULL,
      message       TEXT NOT NULL,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_response_ticket (ticket_id),
      CONSTRAINT fk_response_ticket FOREIGN KEY (ticket_id)
        REFERENCES client_tickets(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Intra-client message board: users belonging to the SAME client can talk to
  // each other. Scoped by client_id; there is no cross-client channel, so
  // messages can never leak between organizations.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_messages (
      id            BIGINT AUTO_INCREMENT PRIMARY KEY,
      client_id     INT NOT NULL,
      author_id     INT NULL,
      author_name   VARCHAR(191) NULL,
      body          TEXT NOT NULL,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_message_client (client_id, id),
      CONSTRAINT fk_message_client FOREIGN KEY (client_id)
        REFERENCES clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

// Client profile fields captured by the Create Client form: the admin-assigned
// Client ID, the specialty, the agreed scope of work, and (for SaaS clients)
// the granted system access. Split out of runMigrations to keep it readable.
async function migrateClientProfile(pool) {
  const cols = [
    // client_code is added NULLable so existing rows can be backfilled before
    // the NOT NULL + UNIQUE constraints are applied below.
    ["client_code", "VARCHAR(64) NULL AFTER id"],
    ["specialty", "VARCHAR(191) NULL AFTER company"],
    // Both are JSON arrays. system_access is only populated for SaaS clients.
    ["scope_of_work", "JSON NULL AFTER specialty"],
    ["system_access", "JSON NULL AFTER scope_of_work"],
    ["contact_person", "VARCHAR(191) NULL AFTER email"],
    ["start_date", "DATE NULL AFTER phone_enc"],
    // Driven by the client's own onboarding submissions, not set by the admin.
    // Stays 'not_started' until the client-side onboarding panel is wired up.
    [
      "onboarding_status",
      "ENUM('not_started','in_progress','submitted','completed') NOT NULL DEFAULT 'not_started' AFTER status",
    ],
  ];

  for (const [name, def] of cols) {
    if (!(await columnExists("clients", name))) {
      await pool.query(`ALTER TABLE clients ADD COLUMN ${name} ${def}`);
    }
  }

  // Give pre-existing clients a stable, unique code so the NOT NULL + UNIQUE
  // constraints below can be applied without rejecting existing rows. The admin
  // can edit these afterwards.
  await pool.query(
    "UPDATE clients SET client_code = CONCAT('CLIENT-', LPAD(id, 4, '0')) WHERE client_code IS NULL OR client_code = ''"
  );

  if (!(await indexExists("clients", "uq_clients_code"))) {
    await pool.query("ALTER TABLE clients MODIFY client_code VARCHAR(64) NOT NULL");
    await pool.query("ALTER TABLE clients ADD UNIQUE KEY uq_clients_code (client_code)");
  }
}

// Usernames are unique per client, not globally: two different clients may each
// have a user called "jsmith". The login form therefore asks for Client ID +
// Username + Password, and the pair (client_id, email) is what must be unique.
// Super admins have client_id NULL — see the guard in the users API for why a
// UNIQUE key alone cannot enforce their uniqueness.
async function migrateUsernameScope(pool) {
  if (await indexExists("users", "uq_users_client_email")) return;

  // A pre-existing globally-unique email cannot coexist with per-client
  // usernames, so it is replaced rather than supplemented.
  if (await indexExists("users", "uq_users_email")) {
    await pool.query("ALTER TABLE users DROP INDEX uq_users_email");
  }
  await pool.query("ALTER TABLE users ADD UNIQUE KEY uq_users_client_email (client_id, email)");
}

async function bootstrapSuperAdmin() {
  const { enabled, email, password, name } = bootstrapConfig();
  if (!enabled) return;

  const pool = getPool();
  // Scoped to client_id IS NULL: usernames are only unique per client now, so a
  // client user could legitimately share this email.
  const [existing] = await pool.execute(
    "SELECT id FROM users WHERE email = :email AND client_id IS NULL LIMIT 1",
    { email }
  );
  if (existing.length > 0) return;

  // Lazy import to avoid bundling bcrypt into edge contexts.
  const { hashPassword } = await import("./crypto.js");
  const password_hash = await hashPassword(password);

  // The bootstrap password is a one-time credential — force the super admin to
  // set their own password on first login, exactly like client users.
  await pool.execute(
    `INSERT INTO users (client_id, name, email, password_hash, role, permissions, is_restricted, must_reset_password)
     VALUES (NULL, :name, :email, :password_hash, 'super_admin', :permissions, 0, 1)`,
    {
      name,
      email,
      password_hash,
      permissions: JSON.stringify(["dashboard", "onboarding"]),
    }
  );
}

export async function writeAudit({ actorId, actorEmail, action, entity, entityId, meta, ip }) {
  try {
    await getPool().execute(
      `INSERT INTO audit_log (actor_id, actor_email, action, entity, entity_id, meta, ip)
       VALUES (:actorId, :actorEmail, :action, :entity, :entityId, :meta, :ip)`,
      {
        actorId: actorId ?? null,
        actorEmail: actorEmail ?? null,
        action,
        entity,
        entityId: entityId != null ? String(entityId) : null,
        meta: meta ? JSON.stringify(meta) : null,
        ip: ip ?? null,
      }
    );
  } catch {
    // Audit failures must never block the primary operation.
  }
}
