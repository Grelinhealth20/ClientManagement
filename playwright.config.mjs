import { defineConfig, devices } from "@playwright/test";

// E2E against a real production build on :5198 (never the dev server on 5174).
// MASTER_ADMIN_EMAIL is overridden for this server process only, so the
// throwaway ZZ account is the master admin for the run and the real master
// (git@grelinhealth.com) is never involved.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.mjs",
  fullyParallel: false, // the suite shares one seeded client — keep it ordered
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  globalSetup: "./tests/global-setup.mjs",
  globalTeardown: "./tests/global-teardown.mjs",
  use: {
    baseURL: "http://localhost:5198",
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx next start -p 5198",
    url: "http://localhost:5198/login",
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: { MASTER_ADMIN_EMAIL: "zz-pw-master@zz.test" },
  },
});
