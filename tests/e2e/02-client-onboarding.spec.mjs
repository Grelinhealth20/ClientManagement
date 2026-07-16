import { test, expect } from "@playwright/test";
import { loginClient, filePayload } from "../fixtures.mjs";

// A facility name that will NOT match the live NPPES registry, so the auto-fill
// never races the test by overwriting fields we typed.
const FACILITY = "ZZ Playwright Test Clinic LLC";

const FACILITY_FIELDS = {
  "Acme Medical Group LLC": FACILITY,
  "Acme Health": "ZZ PW Health",
  "10-digit Type 2 NPI": "1234567893",
  "XX-XXXXXXX": "82-1234567",
  "Provider Transaction Access Number": "PTAN-556677",
};

test.describe.serial("Client — Onboarding wizard (all 4 steps)", () => {
  test("Step 1: fills every facility field and autosaves across reload", async ({ page }) => {
    await loginClient(page);
    await page.goto("/dashboard/onboarding");
    await expect(page.getByRole("heading", { name: "Facility Information" })).toBeVisible();

    // ── Facility details ──
    for (const [ph, val] of Object.entries(FACILITY_FIELDS)) {
      await page.getByPlaceholder(ph, { exact: true }).fill(val);
    }
    // Addresses
    await page.getByPlaceholder("Primary practice address (auto-filled from registry)").fill("100 Main St, Springfield, IL 62701");
    await page.getByPlaceholder("Mailing address (auto-filled from registry)").fill("PO Box 42, Springfield, IL 62701");

    // ── NPPES + PECOS credentials ──
    await page.getByPlaceholder("NPPES username").fill("zz_nppes_user");
    await page.getByPlaceholder("NPPES password").fill("NppesPw!234");
    await page.getByPlaceholder("PECOS username").fill("zz_pecos_user");
    await page.getByPlaceholder("PECOS password").fill("PecosPw!234");

    // ── Contact person ──
    await page.getByPlaceholder("Dana Whitfield").fill("Dana Whitfield");
    await page.getByPlaceholder("dana@acmemed.com").fill("dana@zzpw.test");
    await page.getByPlaceholder("+1 555 0100").fill("555-010-0100");

    // Autosave is debounced — wait for the wizard to report it saved.
    await expect(page.getByText(/Saved/i).first()).toBeVisible({ timeout: 20000 });

    // Everything must survive a full reload (draft is persisted + encrypted).
    await page.reload();
    await expect(page.getByPlaceholder("Acme Medical Group LLC", { exact: true })).toHaveValue(FACILITY);
    await expect(page.getByPlaceholder("10-digit Type 2 NPI")).toHaveValue("1234567893");
    await expect(page.getByPlaceholder("XX-XXXXXXX")).toHaveValue("82-1234567");
    await expect(page.getByPlaceholder("NPPES username")).toHaveValue("zz_nppes_user");
    await expect(page.getByPlaceholder("dana@zzpw.test")).toHaveCount(0); // placeholder != value
    await expect(page.getByPlaceholder("dana@acmemed.com")).toHaveValue("dana@zzpw.test");
  });

  test("Step 1: PECOS 'need to create' toggle hides the credential fields", async ({ page }) => {
    await loginClient(page);
    await page.goto("/dashboard/onboarding");
    const box = page.getByRole("checkbox");
    await box.first().check();
    await expect(page.getByPlaceholder("PECOS username")).toHaveCount(0);
    await box.first().uncheck();
    await expect(page.getByPlaceholder("PECOS username")).toBeVisible();
  });

  test("Step 1: specialty picker adds a taxonomy", async ({ page }) => {
    await loginClient(page);
    await page.goto("/dashboard/onboarding");
    // The picker's trigger sits under the Specialty label
    await page.getByText("Specialty", { exact: true }).first().scrollIntoViewIfNeeded();
    const trigger = page.locator("button").filter({ hasText: /Select specialt|Add specialt|specialt/i }).first();
    await trigger.click();
    const search = page.getByPlaceholder(/search/i).first();
    await search.fill("Radiology");
    await page.getByText(/Radiology/i).nth(1).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText(/Radiology/i).first()).toBeVisible();
  });

  test("Step 1: uploads documents of every format via the drag & drop zone", async ({ page }) => {
    await loginClient(page);
    await page.goto("/dashboard/onboarding");
    await page.getByRole("button", { name: /Documents/i }).first().click();
    await expect(page.getByText("W-9 Form").first()).toBeVisible();

    // W-9 Form is the first mandatory document card, so its hidden input is the
    // first one on the tab. It has no `accept` filter — any format is allowed.
    const input = page.locator('input[type="file"]').first();
    await input.setInputFiles([
      filePayload("w9.pdf", "application/pdf", "%PDF-1.4 test"),
      filePayload("roster.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "PK\x03\x04xlsx"),
      filePayload("contract.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "PK\x03\x04docx"),
      filePayload("payers.csv", "text/csv", "payer,status\nAetna,approved\n"),
      filePayload("logo.png", "image/png", "\x89PNG\r\n\x1a\n"),
    ]);

    await expect(page.getByText("w9.pdf")).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("roster.xlsx")).toBeVisible();
    await expect(page.getByText("contract.docx")).toBeVisible();
    await expect(page.getByText("payers.csv")).toBeVisible();
    await expect(page.getByText("logo.png")).toBeVisible();
  });

  test("Step 2: adds a provider with every section filled", async ({ page }) => {
    await loginClient(page);
    await page.goto("/dashboard/onboarding");
    await page.getByRole("button", { name: /Save & Continue/i }).click();
    await expect(page.getByRole("heading", { name: "Provider Information" })).toBeVisible();

    await page.getByRole("button", { name: /Add Provider/i }).first().click();

    // Personal
    await page.getByPlaceholder("Jordan A. Smith").fill("Dr. Jane Q. Playwright");
    await page.getByPlaceholder("MD, DO, NP…").fill("MD");
    await page.getByPlaceholder("Maiden / former name").fill("Jane Q. Prior");
    await page.getByPlaceholder("XXX-XX-XXXX").fill("123-45-6789");
    await page.getByPlaceholder("City, State/Country").fill("Springfield, IL");
    await page.getByPlaceholder("e.g. United States").fill("United States");
    // Contact
    await page.getByPlaceholder("Street, City, State, ZIP").fill("22 Elm St, Springfield, IL 62701");
    await page.getByPlaceholder("+1 555 0100").fill("555-020-0200");
    await page.getByPlaceholder("jordan@email.com").fill("jane@zzpw.test");
    // Identification
    await page.getByPlaceholder("Driver's license / passport no.").fill("DL-9988776");
    // Professional
    await page.getByPlaceholder("e.g. Physician / Nurse Practitioner").fill("Physician");
    await page.getByPlaceholder("10-digit NPI").fill("1987654321");
    // Licenses
    await page.getByPlaceholder("License no. (comma-separate multiples)").fill("IL-11111, MO-22222");
    await page.getByPlaceholder("DEA no.").fill("BJ1234563");
    await page.getByPlaceholder("Certification no.").fill("ABIM-778899");
    await page.getByPlaceholder("DOH license no.").fill("DOH-556677");
    // Credentialing
    await page.getByPlaceholder("CAQH login").fill("caqh_jane");
    await page.getByPlaceholder("PECOS login").fill("pecos_jane");
    await page.getByPlaceholder("PTAN(s)").fill("PTAN-001");
    await page.getByPlaceholder("Medicaid ID(s)").fill("MCD-002");

    await expect(page.getByText(/Saved/i).first()).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: /Done — back to list/i }).click();

    // The provider now shows in the table view
    await expect(page.getByText("Dr. Jane Q. Playwright")).toBeVisible();
    await expect(page.getByText("1987654321")).toBeVisible();
  });

  test("Step 2: generates an external invite link with a one-time security key", async ({ page }) => {
    await loginClient(page);
    await page.goto("/dashboard/onboarding");
    await page.getByRole("button", { name: /Save & Continue/i }).click();
    await expect(page.getByRole("heading", { name: "Provider Information" })).toBeVisible();

    // Scope to the provider's own table row so we hit the right Invite button.
    const row = page.getByRole("row").filter({ hasText: "Dr. Jane Q. Playwright" });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Invite", exact: true }).click({ force: true });
    // The modal shows the /provider-intake/<token> URL and the one-time
    // XXXX-XXXX-XXXX security key, both in readOnly inputs.
    const urlInput = page.locator('input[readonly]').first();
    await expect(urlInput).toHaveValue(/\/provider-intake\/.+/, { timeout: 25000 });
    const keyInput = page.locator('input[readonly]').nth(1);
    await expect(keyInput).toHaveValue(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  test("Step 3: adds System Access and Payer Portal rows", async ({ page }) => {
    await loginClient(page);
    await page.goto("/dashboard/onboarding");
    await page.getByRole("button", { name: /Save & Continue/i }).click();
    await page.getByRole("button", { name: /Save & Continue/i }).click();
    await expect(page.getByRole("heading", { name: "System & Payer Access" })).toBeVisible();

    // System access — seeded rows exist; fill the first one's credentials
    const userInputs = page.getByPlaceholder("Username");
    const pwInputs = page.getByPlaceholder("Password");
    await userInputs.first().fill("pms_user");
    await pwInputs.first().fill("PmsPw!123");

    // Add a payer portal row
    await page.getByRole("button", { name: /Add Payer Portals/i }).click();
    await expect(userInputs.last()).toBeVisible();
    await userInputs.last().fill("aetna_user");
    await pwInputs.last().fill("AetnaPw!123");

    await expect(page.getByText(/Saved/i).first()).toBeVisible({ timeout: 20000 });
  });

  test("Step 4: review shows the captured data and approval issues a 16-digit reference", async ({ page }) => {
    await loginClient(page);
    await page.goto("/dashboard/onboarding");
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /Save & Continue/i }).click();
    await expect(page.getByRole("heading", { name: "Review & Approve" })).toBeVisible();

    // Everything captured earlier must be read back on the review
    await expect(page.getByText(FACILITY)).toBeVisible();
    await expect(page.getByText("1234567893")).toBeVisible();
    await expect(page.getByText("Dana Whitfield")).toBeVisible();
    await expect(page.getByText("Dr. Jane Q. Playwright")).toBeVisible();

    // Sensitive values are masked until revealed
    await expect(page.getByText("NppesPw!234")).toHaveCount(0);
    await page.getByRole("button", { name: /^Show$/i }).first().click();

    // Approve → 16-digit reference
    await page.getByRole("button", { name: /Approve & Submit/i }).click();
    const ref = page.getByText(/\b\d{16}\b/).first();
    await expect(ref).toBeVisible({ timeout: 30000 });
    const text = await ref.innerText();
    expect(text.replace(/\D/g, "")).toHaveLength(16);
  });
});
