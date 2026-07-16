import { loadEnv, MASTER, SUPER, CLIENT } from "./fixtures.mjs";

loadEnv();
const { query } = await import("../src/lib/db.js");
const { hashPassword } = await import("../src/lib/crypto.js");

/** Remove anything left from a previous run so each run starts clean. */
async function wipe() {
  await query("DELETE FROM clients WHERE client_code LIKE 'ZZ-PW%'");
  await query("DELETE FROM users WHERE email IN (:m,:s)", { m: MASTER.email, s: SUPER.email });
  await query("DELETE FROM users WHERE email LIKE 'zz-pw-%' AND client_id IS NULL");
}

export default async function globalSetup() {
  await wipe();

  const [mp, sp, cp] = await Promise.all([
    hashPassword(MASTER.password),
    hashPassword(SUPER.password),
    hashPassword(CLIENT.password),
  ]);

  // Master admin (the test server runs with MASTER_ADMIN_EMAIL = this address)
  await query(
    `INSERT INTO users (client_id, name, email, password_hash, role, permissions, must_reset_password)
     VALUES (NULL, :n, :e, :p, 'super_admin', NULL, 0)`,
    { n: MASTER.name, e: MASTER.email, p: mp }
  );
  // A plain (non-master) super admin
  await query(
    `INSERT INTO users (client_id, name, email, password_hash, role, permissions, must_reset_password)
     VALUES (NULL, :n, :e, :p, 'super_admin', NULL, 0)`,
    { n: SUPER.name, e: SUPER.email, p: sp }
  );

  // A client + one client user with both dashboard and onboarding access
  const c = await query(
    `INSERT INTO clients (client_code, name, email, status, specialty, scope_of_work, onboarding_status)
     VALUES (:code, :name, :email, 'active', 'Radiology', :sow, 'not_started')`,
    { code: CLIENT.code, name: CLIENT.name, email: CLIENT.email, sow: JSON.stringify(["credentialing", "coding"]) }
  );
  await query(
    `INSERT INTO users (client_id, name, email, password_hash, role, permissions, must_reset_password)
     VALUES (:cid, 'ZZ PW User', :e, :p, 'client_user', :perm, 0)`,
    { cid: c.insertId, e: CLIENT.username, p: cp, perm: JSON.stringify(["dashboard", "onboarding"]) }
  );

  console.log(`\n[global-setup] seeded master/super admins + client ${CLIENT.code} (#${c.insertId})`);
}
