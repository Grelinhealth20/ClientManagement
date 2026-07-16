"use client";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import { EditIcon } from "@/components/icons";
import { SectionPanel } from "./ui";

/**
 * Final review — a complete, accurate read-back of every field captured across
 * the wizard and every uploaded document, so nothing is approved unseen. Edit
 * jumps back to the relevant step. Sensitive values (passwords, SSN) are hidden
 * behind a per-field reveal.
 */
export default function StepReview({ data, documents, onJump, onApprove, approving, status, reference }) {
  const toast = useToast();
  const f = data.facility || {};
  const providers = Array.isArray(data.providers) ? data.providers : [];
  const sa = data.systemAccess || {};
  const approved = status === "approved";

  const facilityDocs = documents.filter((d) => d.scope === "facility");
  const providerDocs = (key) => documents.filter((d) => d.scope === "provider" && d.provider_key === key);

  async function view(doc) {
    try {
      const res = await fetch(`/api/onboarding/documents/${doc.id}`, { credentials: "same-origin" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Could not open document.");
      window.open(j.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-4">
      {approved && (
        <div className="rounded-xl2 border border-emerald-200 bg-emerald-50 px-5 py-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">Approved</p>
          <p className="mt-1 text-sm font-semibold text-emerald-800">
            Reference: <span className="font-mono text-base font-extrabold tracking-wider">{reference}</span>
          </p>
        </div>
      )}

      {/* ── Facility ── */}
      <ReviewCard title="Step 1 · Facility Information" onEdit={() => onJump(1)}>
        <Grp label="Facility">
          <KV k="Facility Name" v={f.facilityName} />
          <KV k="DBA Name" v={f.dbaName} />
          <KV k="Group NPI" v={f.groupNPI} />
          <Secret k="Group Tax ID (EIN)" v={f.groupTaxId} />
          <KV k="PTAN" v={f.ptan} />
          <KV k="Specialty" v={(f.specialties || []).map((s) => s.label + (s.code ? ` (${s.code})` : " · custom")).join(", ")} full />
          <KV k="Facility Address" v={f.facilityAddress} full />
          <KV k="Mailing Address" v={f.mailingAddress ?? f.otherLocationAddress} full />
        </Grp>
        <Grp label="NPPES Credentials">
          <KV k="Username" v={f.nppes?.username} />
          <Secret k="Password" v={f.nppes?.password} />
        </Grp>
        <Grp label="PECOS Credentials">
          {f.pecos?.needCreate ? (
            <KV k="PECOS" v="Needs to be created" full />
          ) : (
            <>
              <KV k="Username" v={f.pecos?.username} />
              <Secret k="Password" v={f.pecos?.password} />
            </>
          )}
        </Grp>
        <Grp label="Contact Person">
          <KV k="Name" v={f.contactName} />
          <KV k="Email" v={f.contactEmail} />
          <KV k="Phone" v={f.contactPhone} />
        </Grp>
        <DocGroup label="Facility Documents" docs={facilityDocs} onView={view} />
      </ReviewCard>

      {/* ── Providers ── */}
      {providers.length === 0 ? (
        <ReviewCard title="Step 2 · Providers" onEdit={() => onJump(2)}>
          <p className="text-[13px] font-medium text-slate-400 sm:col-span-2">No providers added.</p>
        </ReviewCard>
      ) : (
        providers.map((p, i) => {
          const per = p.personal || {};
          const con = p.contact || {};
          const idn = p.identification || {};
          const pro = p.professional || {};
          const lic = p.licenses || {};
          const cre = p.credentialing || {};
          return (
            <ReviewCard
              key={p.key}
              title={`Step 2 · Provider ${i + 1}${per.fullLegalName ? " — " + per.fullLegalName : ""}${p._source === "external" ? "  (external)" : ""}`}
              onEdit={() => onJump(2)}
            >
              <Grp label="Personal">
                <KV k="Full Legal Name" v={per.fullLegalName} />
                <KV k="Suffix" v={per.suffix} />
                <KV k="Other Names Used" v={per.otherNames} />
                <KV k="Date of Birth" v={per.dob} />
                <Secret k="SSN" v={per.ssn} />
                <KV k="Gender" v={per.gender} />
                <KV k="Place of Birth" v={per.placeOfBirth} />
                <KV k="Citizenship" v={per.citizenship} />
              </Grp>
              <Grp label="Contact">
                <KV k="Home / Mailing Address" v={con.address} full />
                <KV k="Phone" v={con.phone} />
                <KV k="Email" v={con.email} />
              </Grp>
              <Grp label="Identification">
                <KV k="Government-Issued ID Number" v={idn.govIdNumber} full />
              </Grp>
              <Grp label="Professional">
                <KV k="Provider Type / NUCC Grouping" v={pro.providerType} />
                <KV k="Individual (Type 1) NPI" v={pro.npi} />
                <KV k="Taxonomy" v={(pro.taxonomies || []).map((t) => t.label + (t.code ? ` (${t.code})` : "")).join(", ")} full />
              </Grp>
              <Grp label="Licenses & Certifications">
                <KV k="State Professional License(s)" v={lic.stateLicenseNumber} />
                <KV k="DEA Registration" v={lic.deaNumber} />
                <KV k="Board Certification(s)" v={lic.boardCertNumber} />
                <KV k="State DOH License" v={lic.dohLicenseNumber} />
              </Grp>
              <Grp label="Credentialing & Enrollment">
                <KV k="CAQH Username" v={cre.caqhUsername} />
                <Secret k="CAQH Password" v={cre.caqhPassword} />
                <KV k="PECOS Username" v={cre.pecosUsername} />
                <Secret k="PECOS Password" v={cre.pecosPassword} />
                <KV k="Individual PTAN(s)" v={cre.ptans} />
                <KV k="State Medicaid ID(s)" v={cre.medicaidIds} />
              </Grp>
              <DocGroup label="Provider Documents" docs={providerDocs(p.key)} onView={view} />
            </ReviewCard>
          );
        })
      )}

      {/* ── System & Payer Access ── */}
      <ReviewCard title="Step 3 · System & Payer Access" onEdit={() => onJump(3)}>
        <Grp label="System Access">
          {(sa.systems || []).length === 0 ? (
            <p className="text-[13px] font-medium text-slate-400 sm:col-span-2">No system access added.</p>
          ) : (
            (sa.systems || []).map((s, i) => (
              <div key={s.key || i} className="sm:col-span-2 grid grid-cols-1 gap-x-6 gap-y-2.5 border-b border-line/60 pb-2.5 sm:grid-cols-3">
                <KV k="Access Name" v={s.name} />
                <KV k="Username" v={s.username} />
                <Secret k="Password" v={s.password} />
              </div>
            ))
          )}
        </Grp>
        <Grp label="Payer Portals">
          {(sa.payers || []).length === 0 ? (
            <p className="text-[13px] font-medium text-slate-400 sm:col-span-2">No payer portals added.</p>
          ) : (
            (sa.payers || []).map((p, i) => (
              <div key={p.key || i} className="sm:col-span-2 grid grid-cols-1 gap-x-6 gap-y-2.5 border-b border-line/60 pb-2.5 sm:grid-cols-3">
                <KV k="Payer Name" v={p.name} />
                <KV k="Username" v={p.username} />
                <Secret k="Password" v={p.password} />
              </div>
            ))
          )}
        </Grp>
      </ReviewCard>

      {/* ── Approve ── */}
      <div className="rounded-xl2 border-2 border-copper/30 bg-gradient-to-br from-copper/5 to-white p-5 shadow-elev">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-navy">
              {approved ? "This onboarding has been approved." : "Confirm every detail above, then approve."}
            </p>
            <p className="mt-0.5 text-[12px] font-medium text-slate-500">
              {approved
                ? "You can still edit and re-approve if anything changes."
                : "Approving generates a unique 16-digit reference and records this submission."}
            </p>
          </div>
          <Button onClick={onApprove} loading={approving}>
            {approved ? "Re-approve" : "Approve & Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ title, onEdit, children }) {
  return (
    <SectionPanel
      title={title}
      right={
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-extrabold text-white transition-colors hover:bg-white hover:text-navy"
        >
          <EditIcon size={12} /> Edit
        </button>
      }
    >
      <div className="space-y-4">{children}</div>
    </SectionPanel>
  );
}

/** A labelled sub-group of fields. */
function Grp({ label, children }) {
  return (
    <div>
      <p className="mb-2 border-b border-line pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-copper-700">
        {label}
      </p>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function KV({ k, v, full }) {
  return (
    <div className={`min-w-0 ${full ? "sm:col-span-2" : ""}`}>
      <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{k}</dt>
      <dd className="mt-0.5 break-words text-[13px] font-bold text-navy">
        {v || <span className="font-medium text-slate-300">—</span>}
      </dd>
    </div>
  );
}

/** Sensitive value hidden behind a reveal toggle. */
function Secret({ k, v, full }) {
  const [shown, setShown] = useState(false);
  return (
    <div className={`min-w-0 ${full ? "sm:col-span-2" : ""}`}>
      <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{k}</dt>
      <dd className="mt-0.5 flex items-center gap-2">
        <span className="break-all text-[13px] font-bold text-navy">
          {!v ? (
            <span className="font-medium text-slate-300">—</span>
          ) : shown ? (
            v
          ) : (
            "•".repeat(Math.min(String(v).length, 12))
          )}
        </span>
        {v && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            className="shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[10px] font-extrabold text-slate-500 transition-colors hover:border-copper/40 hover:text-copper-700"
          >
            {shown ? "Hide" : "Show"}
          </button>
        )}
      </dd>
    </div>
  );
}

function DocGroup({ label, docs, onView }) {
  return (
    <div>
      <p className="mb-2 border-b border-line pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-copper-700">
        {label} ({docs.length})
      </p>
      {docs.length === 0 ? (
        <p className="text-[12px] font-medium text-slate-400">No documents uploaded.</p>
      ) : (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {docs.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onView(d)}
              className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 text-left transition-colors hover:bg-emerald-100"
              title="View document"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-emerald-600">
                <path d="M14 3v5h5M6 3h8l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" strokeLinejoin="round" />
              </svg>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold text-navy">{d.doc_type}</span>
                <span className="block truncate text-[10px] font-medium text-emerald-600">{d.filename} · View</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
