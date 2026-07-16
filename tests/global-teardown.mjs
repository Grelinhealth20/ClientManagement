import { loadEnv, MASTER, SUPER } from "./fixtures.mjs";

loadEnv();
const { query } = await import("../src/lib/db.js");
const { deleteObject } = await import("../src/lib/s3.js");

/** Delete every S3 object the run created, then the DB rows (cascade). */
export default async function globalTeardown() {
  const ids = await query("SELECT id FROM clients WHERE client_code LIKE 'ZZ-PW%'");
  for (const { id } of ids) {
    const docs = await query(
      `SELECT s3_key FROM onboarding_documents WHERE client_id = :id
       UNION ALL
       SELECT s3_key FROM checklist_documents WHERE client_id = :id`,
      { id }
    );
    for (const d of docs) {
      try { await deleteObject(d.s3_key); } catch {}
    }
  }
  await query("DELETE FROM clients WHERE client_code LIKE 'ZZ-PW%'");
  await query("DELETE FROM users WHERE email IN (:m,:s)", { m: MASTER.email, s: SUPER.email });
  await query("DELETE FROM users WHERE email LIKE 'zz-pw-%' AND client_id IS NULL");
  console.log("[global-teardown] removed all ZZ-PW test data (DB + S3)");
}
