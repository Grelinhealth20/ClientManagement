"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Input, Textarea } from "@/components/ui/Field";
import SpecialtyPicker from "./SpecialtyPicker";
import DocumentUpload from "./DocumentUpload";
import NppesAutofill from "./NppesAutofill";
import { SectionPanel, SubNav } from "./ui";

export const MANDATORY_DOCS = [
  "W-9 Form",
  "IRS EIN Assignment Letter (CP-575 or IRS 147C)",
  "Articles of Incorporation / Articles of Organization",
  "Organization (Type 2) NPI Confirmation Letter",
  "State Facility License (if required by the state)",
  "Professional Liability (Malpractice) Insurance Certificate",
  "Voided Check or Bank Verification Letter (for EFT)",
  "Business License (if required by the state)",
  "Authorized Signatory Authorization Letter",
];

export const CONDITIONAL_DOCS = [
  "CLIA Certificate",
  "Accreditation Certificate (CARF, ACHC, Joint Commission, CHAP, etc.)",
  "DEA Registration Certificate (facility)",
  "Certificate of Good Standing",
  "Ownership Disclosure Documents",
];

const InfoIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
  </svg>
);
const DocIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <path d="M14 3v5h5M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" strokeLinejoin="round" />
    <path d="M9 13h6M9 17h4" strokeLinecap="round" />
  </svg>
);

export default function StepFacility({ facility, setFacility, documents, onUploaded, onRemoved }) {
  const [view, setView] = useState("info");
  const f = facility || {};
  const nppes = f.nppes || {};
  const pecos = f.pecos || {};
  const facilityDocCount = documents.filter((d) => d.scope === "facility").length;

  const docsFor = (docType) =>
    documents.filter((d) => d.scope === "facility" && d.doc_type === docType);

  return (
    <div className="space-y-4">
      {/* Centered sub-navbar: Information / Documents */}
      <SubNav
        value={view}
        onChange={setView}
        tabs={[
          { value: "info", label: "Information", icon: InfoIcon },
          { value: "docs", label: "Documents", icon: DocIcon, badge: facilityDocCount || null },
        ]}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {view === "info" ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <SectionPanel title="Facility Details" icon={InfoIcon} className="xl:col-span-2">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Input label="Facility Name" value={f.facilityName || ""} onChange={(e) => setFacility({ facilityName: e.target.value })} placeholder="Acme Medical Group LLC" required />
                  <Input label="DBA Name" value={f.dbaName || ""} onChange={(e) => setFacility({ dbaName: e.target.value })} placeholder="Acme Health" />
                  <Input label="Group NPI" value={f.groupNPI || ""} onChange={(e) => setFacility({ groupNPI: e.target.value })} placeholder="10-digit Type 2 NPI" inputMode="numeric" />
                  <Input label="Group Tax ID (EIN)" value={f.groupTaxId || ""} onChange={(e) => setFacility({ groupTaxId: e.target.value })} placeholder="XX-XXXXXXX" />
                  <Input label="PTAN" value={f.ptan || ""} onChange={(e) => setFacility({ ptan: e.target.value })} placeholder="Provider Transaction Access Number" />
                </div>

                {/* Automatic NPPES registry lookup — fills fields from the name */}
                <NppesAutofill facility={f} onApply={setFacility} />

                <div className="mt-4">
                  <label className="field-label">Specialty</label>
                  <SpecialtyPicker value={f.specialties || []} onChange={(specialties) => setFacility({ specialties })} />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Textarea label="Facility Address" rows={2} value={f.facilityAddress || ""} onChange={(e) => setFacility({ facilityAddress: e.target.value })} placeholder="Primary practice address (auto-filled from registry)" />
                  <Textarea label="Mailing Address" rows={2} value={f.mailingAddress ?? f.otherLocationAddress ?? ""} onChange={(e) => setFacility({ mailingAddress: e.target.value })} placeholder="Mailing address (auto-filled from registry)" />
                </div>
              </SectionPanel>

              <SectionPanel title="NPPES Login Credentials" icon={LockIcon}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Username" value={nppes.username || ""} onChange={(e) => setFacility({ nppes: { ...nppes, username: e.target.value } })} placeholder="NPPES username" autoComplete="off" />
                  <Input label="Password" type="password" value={nppes.password || ""} onChange={(e) => setFacility({ nppes: { ...nppes, password: e.target.value } })} placeholder="NPPES password" autoComplete="new-password" />
                </div>
              </SectionPanel>

              <SectionPanel title="PECOS Login Credentials" icon={LockIcon}>
                <label className="mb-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-mist/50 px-3 py-2.5 transition-colors hover:border-copper/40">
                  <input type="checkbox" checked={!!pecos.needCreate} onChange={(e) => setFacility({ pecos: { ...pecos, needCreate: e.target.checked } })} className="h-4 w-4 accent-navy" />
                  <span className="text-[13px] font-bold text-navy">Not available — need to create a PECOS account</span>
                </label>
                {!pecos.needCreate && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input label="Username" value={pecos.username || ""} onChange={(e) => setFacility({ pecos: { ...pecos, username: e.target.value } })} placeholder="PECOS username" autoComplete="off" />
                    <Input label="Password" type="password" value={pecos.password || ""} onChange={(e) => setFacility({ pecos: { ...pecos, password: e.target.value } })} placeholder="PECOS password" autoComplete="new-password" />
                  </div>
                )}
              </SectionPanel>

              <SectionPanel title="Contact Person" icon={UserIcon} className="xl:col-span-2">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Input label="Contact Person Name" value={f.contactName || ""} onChange={(e) => setFacility({ contactName: e.target.value })} placeholder="Dana Whitfield" />
                  <Input label="Contact Person Email" type="email" value={f.contactEmail || ""} onChange={(e) => setFacility({ contactEmail: e.target.value })} placeholder="dana@acmemed.com" />
                  <Input label="Contact Person Phone Number" value={f.contactPhone || ""} onChange={(e) => setFacility({ contactPhone: e.target.value })} placeholder="+1 555 0100" />
                </div>
              </SectionPanel>
            </div>
          ) : (
            <div className="space-y-4">
              <SectionPanel title="Mandatory Documents" icon={DocIcon} accent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {MANDATORY_DOCS.map((d) => (
                    <DocumentUpload key={d} label={d} required category="mandatory" scope="facility" files={docsFor(d)} onUploaded={onUploaded} onRemoved={onRemoved} />
                  ))}
                </div>
              </SectionPanel>
              <SectionPanel title="Conditional Documents" icon={DocIcon}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {CONDITIONAL_DOCS.map((d) => (
                    <DocumentUpload key={d} label={d} category="conditional" scope="facility" files={docsFor(d)} onUploaded={onUploaded} onRemoved={onRemoved} />
                  ))}
                </div>
              </SectionPanel>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const LockIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);
const UserIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
  </svg>
);
