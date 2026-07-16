"use client";
import { Input, Textarea, Select } from "@/components/ui/Field";
import SpecialtyPicker from "./SpecialtyPicker";

// The provider document requirements, in the order they appear in the form.
export const PROVIDER_DOCS = [
  { docType: "Government-Issued Photo ID", category: "identification" },
  { docType: "Recent Professional Photo", category: "identification" },
  { docType: "Curriculum Vitae (CV)", category: "professional" },
  { docType: "State Professional License", category: "licenses" },
  { docType: "DEA Registration Certificate", category: "licenses" },
  { docType: "Board Certification", category: "licenses" },
  { docType: "State DOH License", category: "licenses" },
];

/** A fresh provider slot. `key` must be supplied by the caller. */
export function blankProvider(key) {
  return {
    key,
    personal: {},
    contact: {},
    identification: {},
    professional: { taxonomies: [] },
    licenses: {},
    credentialing: {},
  };
}

/**
 * All provider input sections. Shared between the internal Step 2 and the
 * external intake page. `renderDoc(docType, category)` lets each context plug in
 * its own uploader (authenticated vs. token-based).
 */
export default function ProviderFields({ provider, onChange, renderDoc }) {
  const p = provider || {};
  const set = (section, patch) =>
    onChange({ ...p, [section]: { ...(p[section] || {}), ...patch } });

  const personal = p.personal || {};
  const contact = p.contact || {};
  const ident = p.identification || {};
  const prof = p.professional || {};
  const lic = p.licenses || {};
  const cred = p.credentialing || {};

  return (
    <div className="space-y-5">
      <Section n={1} icon={Icons.personal} title="Personal Information">
        <Grid>
          <Input label="Full Legal Name" value={personal.fullLegalName || ""} onChange={(e) => set("personal", { fullLegalName: e.target.value })} placeholder="Jordan A. Smith" required />
          <Input label="Suffix" value={personal.suffix || ""} onChange={(e) => set("personal", { suffix: e.target.value })} placeholder="MD, DO, NP…" />
          <Input label="Other Names Used" value={personal.otherNames || ""} onChange={(e) => set("personal", { otherNames: e.target.value })} placeholder="Maiden / former name" />
          <Input label="Date of Birth" type="date" value={personal.dob || ""} onChange={(e) => set("personal", { dob: e.target.value })} />
          <Input label="Social Security Number (SSN)" value={personal.ssn || ""} onChange={(e) => set("personal", { ssn: e.target.value })} placeholder="XXX-XX-XXXX" autoComplete="off" />
          <Select label="Gender" value={personal.gender || ""} onChange={(e) => set("personal", { gender: e.target.value })}>
            <option value="">Select…</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
            <option value="undisclosed">Prefer not to say</option>
          </Select>
          <Input label="Place of Birth" value={personal.placeOfBirth || ""} onChange={(e) => set("personal", { placeOfBirth: e.target.value })} placeholder="City, State/Country" />
          <Input label="Citizenship" value={personal.citizenship || ""} onChange={(e) => set("personal", { citizenship: e.target.value })} placeholder="e.g. United States" />
        </Grid>
      </Section>

      <Section n={2} icon={Icons.contact} title="Contact Information">
        <Grid>
          <Textarea label="Home / Mailing Address" rows={2} value={contact.address || ""} onChange={(e) => set("contact", { address: e.target.value })} placeholder="Street, City, State, ZIP" className="sm:col-span-2" />
          <Input label="Personal Phone Number" value={contact.phone || ""} onChange={(e) => set("contact", { phone: e.target.value })} placeholder="+1 555 0100" />
          <Input label="Personal Email Address" type="email" value={contact.email || ""} onChange={(e) => set("contact", { email: e.target.value })} placeholder="jordan@email.com" />
        </Grid>
      </Section>

      <Section n={3} icon={Icons.credential} title="Credentialing & Enrollment">
        <Grid>
          <Input label="CAQH Username" value={cred.caqhUsername || ""} onChange={(e) => set("credentialing", { caqhUsername: e.target.value })} placeholder="CAQH login" autoComplete="off" />
          <Input label="CAQH Password" type="password" value={cred.caqhPassword || ""} onChange={(e) => set("credentialing", { caqhPassword: e.target.value })} autoComplete="new-password" />
          <Input label="Existing PECOS Username" value={cred.pecosUsername || ""} onChange={(e) => set("credentialing", { pecosUsername: e.target.value })} placeholder="PECOS login" autoComplete="off" />
          <Input label="Existing PECOS Password" type="password" value={cred.pecosPassword || ""} onChange={(e) => set("credentialing", { pecosPassword: e.target.value })} autoComplete="new-password" />
          <Input label="Existing Individual PTAN(s)" value={cred.ptans || ""} onChange={(e) => set("credentialing", { ptans: e.target.value })} placeholder="PTAN(s)" />
          <Input label="Existing State Medicaid ID(s)" value={cred.medicaidIds || ""} onChange={(e) => set("credentialing", { medicaidIds: e.target.value })} placeholder="Medicaid ID(s)" />
        </Grid>
      </Section>

      <Section n={4} icon={Icons.id} title="Identification">
        <Grid>
          <Input label="Government-Issued Photo ID Number" value={ident.govIdNumber || ""} onChange={(e) => set("identification", { govIdNumber: e.target.value })} placeholder="Driver's license / passport no." />
        </Grid>
        <DocRow>
          {renderDoc("Government-Issued Photo ID", "identification")}
          {renderDoc("Recent Professional Photo", "identification")}
        </DocRow>
      </Section>

      <Section n={5} icon={Icons.professional} title="Professional Information">
        <Grid>
          <Input label="Provider Type / NUCC Grouping" value={prof.providerType || ""} onChange={(e) => set("professional", { providerType: e.target.value })} placeholder="e.g. Physician / Nurse Practitioner" />
          <Input label="Individual (Type 1) NPI" value={prof.npi || ""} onChange={(e) => set("professional", { npi: e.target.value })} placeholder="10-digit NPI" inputMode="numeric" />
        </Grid>
        <div className="mt-3">
          <label className="field-label">Individual Taxonomy Code</label>
          <SpecialtyPicker value={prof.taxonomies || []} onChange={(taxonomies) => set("professional", { taxonomies })} />
        </div>
        <DocRow>{renderDoc("Curriculum Vitae (CV)", "professional")}</DocRow>
      </Section>

      <Section n={6} icon={Icons.license} title="Professional Licenses & Certifications">
        <Grid>
          <Input label="State Professional License Number(s)" value={lic.stateLicenseNumber || ""} onChange={(e) => set("licenses", { stateLicenseNumber: e.target.value })} placeholder="License no. (comma-separate multiples)" />
          <Input label="DEA Registration Number" value={lic.deaNumber || ""} onChange={(e) => set("licenses", { deaNumber: e.target.value })} placeholder="DEA no." />
          <Input label="Board Certification Number(s)" value={lic.boardCertNumber || ""} onChange={(e) => set("licenses", { boardCertNumber: e.target.value })} placeholder="Certification no." />
          <Input label="State DOH License Number" value={lic.dohLicenseNumber || ""} onChange={(e) => set("licenses", { dohLicenseNumber: e.target.value })} placeholder="DOH license no." />
        </Grid>
        <DocRow>
          {renderDoc("State Professional License", "licenses")}
          {renderDoc("DEA Registration Certificate", "licenses")}
          {renderDoc("Board Certification", "licenses")}
          {renderDoc("State DOH License", "licenses")}
        </DocRow>
      </Section>

    </div>
  );
}

// Section icons.
const Icons = {
  personal: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
    </svg>
  ),
  contact: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M4 5a2 2 0 0 1 2-2h2l2 5-2 1a11 11 0 0 0 5 5l1-2 5 2v2a2 2 0 0 1-2 2A16 16 0 0 1 4 5z" strokeLinejoin="round" />
    </svg>
  ),
  id: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M5.5 16a3.2 3.2 0 0 1 6 0M14 10h4M14 14h4" strokeLinecap="round" />
    </svg>
  ),
  professional: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" strokeLinecap="round" />
    </svg>
  ),
  license: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <circle cx="12" cy="9" r="5" />
      <path d="M9 13.5L8 21l4-2 4 2-1-7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  credential: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <circle cx="8" cy="14" r="3.5" />
      <path d="M10.5 11.5L20 2M17 5l2.5 2.5M14.5 7.5L17 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

function Section({ n, icon: Icon, title, children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white shadow-crisp">
      <header className="flex items-center gap-2.5 border-b border-line bg-gradient-to-r from-mist/70 to-white px-4 py-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-navy text-[11px] font-extrabold text-white">
          {n}
        </span>
        {Icon && (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-copper/10 text-copper-700">
            <Icon width="15" height="15" />
          </span>
        )}
        <h4 className="text-[12px] font-extrabold uppercase tracking-wider text-navy">{title}</h4>
      </header>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function DocRow({ children }) {
  return <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
