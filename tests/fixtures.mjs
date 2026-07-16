// Shared constants + helpers for the Playwright E2E suite.
// Everything here is throwaway (ZZ-*) and is removed in global-teardown.
import fs from "fs";
import path from "path";

export const BASE = "http://localhost:5198";

// The test server is started with MASTER_ADMIN_EMAIL pointed at this account,
// so it is the master admin for the test run ONLY. The real master admin
// (git@grelinhealth.com) is never touched.
export const MASTER = { email: "zz-pw-master@zz.test", password: "ZzMaster!1", name: "ZZ PW Master" };
export const SUPER = { email: "zz-pw-super@zz.test", password: "ZzSuper!1", name: "ZZ PW Super" };
export const CLIENT = {
  code: "ZZ-PW",
  name: "ZZ Playwright Clinic",
  username: "zzpw",
  password: "ZzClient!1",
  email: "zz-pw@zz.test",
};

/** Load .env into process.env (Playwright's node process doesn't get --env-file). */
export function loadEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}

/** Sign in through the real login form. Leave clientCode blank for admins. */
export async function login(page, { clientCode = "", username, password }) {
  await page.goto(`${BASE}/login`);
  if (clientCode) await page.fill("#client_id", clientCode);
  await page.fill("#username", username);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(admin|dashboard)/, { timeout: 20000 });
}

export const loginClient = (page) =>
  login(page, { clientCode: CLIENT.code, username: CLIENT.username, password: CLIENT.password });
export const loginSuper = (page) => login(page, { username: SUPER.email, password: SUPER.password });
export const loginMaster = (page) => login(page, { username: MASTER.email, password: MASTER.password });

/** A real in-memory file for upload tests (no temp files on disk). */
export const filePayload = (name, mimeType, body) => ({
  name,
  mimeType,
  buffer: Buffer.from(body),
});
