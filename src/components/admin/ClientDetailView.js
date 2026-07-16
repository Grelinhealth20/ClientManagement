"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { CloseIcon, PlusIcon } from "@/components/icons";
import { api } from "@/lib/api";
import { ONBOARDING_STATUS } from "@/lib/domain";

const TABS = [
  { key: "facility", label: "Facility" },
  { key: "providers", label: "Providers" },
  { key: "access", label: "System & Payer" },
  { key: "documents", label: "Documents" },
];

const icon = (paths) => (p) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>{paths}</svg>
);
const TAB_ICONS = {
  facility: icon(<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5" strokeLinejoin="round" />),
  providers: icon(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.2a3.2 3.2 0 0 1 0 6M17.5 20a5.5 5.5 0 0 0-3-4.9" strokeLinecap="round" /></>),
  access: icon(<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" strokeLinecap="round" /></>),
  documents: icon(<><path d="M14 3v5h5M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" strokeLinejoin="round" /></>),
};

/** Does the client have ANY onboarding content yet? */
function hasAny(data, documents) {
  const f = data?.facility || {};
  return !!(
    f.facilityName || f.groupNPI || f.contactName ||
    (data?.providers || []).length ||
    (data?.systemAccess?.systems || []).length ||
    (data?.systemAccess?.payers || []).length ||
    (documents || []).length
  );
}

/**
 * Full-screen enterprise detail view for a client. Shows the whole 4-step
 * onboarding, per-provider tabs, downloadable documents, and lets the admin edit
 * payer portals / system access in real time (autosaved).
 */
export default function ClientDetailView({ client, open, onClose }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [tab, setTab] = useState("facility");
  const [access, setAccess] = useState(null); // editable systemAccess copy
  const [saveState, setSaveState] = useState("idle");
  const timerRef = useRef(null);
  const skip = useRef(true);

  const id = client?.id;

  useEffect(() => {
    if (!open || !id) return;
    setLoading(true);
    setTab("facility");
    skip.current = true;
    (async () => {
      try {
        const res = await api(`/api/admin/clients/${id}/onboarding`);
        setPayload(res);
        setAccess(res.draft?.data?.systemAccess || { systems: [], payers: [] });
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);

  const persistAccess = useCallback(
    async (next) => {
      setSaveState("saving");
      try {
        await api(`/api/admin/clients/${id}/onboarding`, {
          method: "PUT",
          body: { patch: { systemAccess: next } },
        });
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
        toast.error(e.message);
      }
    },
    [id, toast]
  );

  // Debounced autosave when payer/system access is edited.
  useEffect(() => {
    if (!open || access == null) return;
    if (skip.current) {
      skip.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState("saving");
    timerRef.current = setTimeout(() => persistAccess(access), 800);
    return () => timerRef.current && clearTimeout(timerRef.current);
  }, [access, open, persistAccess]);

  const data = payload?.draft?.data || {};
  const status = ONBOARDING_STATUS.find((s) => s.value === payload?.client?.onboarding_status) ?? ONBOARDING_STATUS[0];

  async function openDoc(docId, download) {
    try {
      const res = await api(`/api/admin/clients/${id}/documents/${docId}${download ? "?download=1" : ""}`);
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex flex-col bg-mist"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
        >
          {/* Header — dark command hero */}
          <header className="relative shrink-0 overflow-hidden border-b border-navy/40 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900">
            <div className="tech-grid pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.05) 1px,transparent 1px)" }} />
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-copper/15 blur-2xl" />
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-navy-700 via-copper to-navy-700" />
            <div className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3.5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 text-[16px] font-extrabold text-copper ring-1 ring-inset ring-white/20 backdrop-blur">
                  {(client?.name?.[0] || "?").toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-copper">{client?.client_code}</p>
                  <h2 className="truncate text-xl font-extrabold tracking-tight text-white">{client?.name}</h2>
                  <p className="truncate text-[11px] font-semibold text-white/55">{client?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SaveBadge state={saveState} />
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-white hover:text-navy"
                >
                  <CloseIcon size={15} /> Close
                </button>
              </div>
            </div>

            {/* Centered segmented tabs */}
            <div className="relative flex justify-center px-4 pb-4 sm:px-6">
              <nav className="flex items-center gap-1 rounded-2xl border border-white/15 bg-white/10 p-1 backdrop-blur-sm">
                {TABS.map((t) => {
                  const active = tab === t.key;
                  const Icon = TAB_ICONS[t.key];
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className="relative flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-extrabold tracking-tight outline-none"
                    >
                      {active && <motion.span layoutId="admin-detail-tab" className="absolute inset-0 rounded-xl bg-white shadow-elev" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                      {Icon && <Icon className={`relative z-10 ${active ? "text-copper-700" : "text-white/60"}`} />}
                      <span className={`relative z-10 whitespace-nowrap ${active ? "text-navy" : "text-white/70"}`}>{t.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </header>

          <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
              {loading ? (
                <Skeleton />
              ) : (
                <>
                  <OverviewStrip client={payload.client} draft={payload.draft} providers={data.providers || []} documents={payload.documents} users={payload.users} status={status} />
                  {!hasAny(data, payload.documents) ? (
                    <NotStarted />
                  ) : (
                    <>
                      {tab === "facility" && <FacilityTab f={data.facility || {}} />}
                      {tab === "providers" && <ProvidersTab providers={data.providers || []} documents={payload.documents} onDoc={openDoc} />}
                      {tab === "access" && access && <AccessTab access={access} setAccess={setAccess} />}
                      {tab === "documents" && <DocumentsTab documents={payload.documents} providers={data.providers || []} onDoc={openDoc} />}
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Facility ── */
function FacilityTab({ f }) {
  return (
    <div className="space-y-4">
      <Card title="Facility Details">
        <Grid>
          <KV k="Facility Name" v={f.facilityName} />
          <KV k="DBA Name" v={f.dbaName} />
          <KV k="Group NPI" v={f.groupNPI} />
          <Secret k="Group Tax ID" v={f.groupTaxId} />
          <KV k="PTAN" v={f.ptan} />
          <KV k="Specialty" v={(f.specialties || []).map((s) => s.label).join(", ")} full />
          <KV k="Facility Address" v={f.facilityAddress} full />
          <KV k="Mailing Address" v={f.mailingAddress ?? f.otherLocationAddress} full />
        </Grid>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="NPPES">
          <Grid>
            <KV k="Username" v={f.nppes?.username} />
            <Secret k="Password" v={f.nppes?.password} />
          </Grid>
        </Card>
        <Card title="PECOS">
          <Grid>
            {f.pecos?.needCreate ? <KV k="PECOS" v="Needs to be created" full /> : <><KV k="Username" v={f.pecos?.username} /><Secret k="Password" v={f.pecos?.password} /></>}
          </Grid>
        </Card>
      </div>
      <Card title="Contact Person">
        <Grid>
          <KV k="Name" v={f.contactName} />
          <KV k="Email" v={f.contactEmail} />
          <KV k="Phone" v={f.contactPhone} />
        </Grid>
      </Card>
    </div>
  );
}

/* ── Providers (auto per-provider tabs) ── */
function ProvidersTab({ providers, documents, onDoc }) {
  const [sel, setSel] = useState(0);
  if (!providers.length) return <Empty>No providers added.</Empty>;
  const p = providers[sel] || providers[0];
  const per = p.personal || {}, con = p.contact || {}, pro = p.professional || {}, lic = p.licenses || {}, cre = p.credentialing || {}, idn = p.identification || {};
  const docs = documents.filter((d) => d.scope === "provider" && d.provider_key === p.key);
  return (
    <div className="space-y-4">
      {/* per-provider tab strip */}
      <div className="flex flex-wrap gap-1.5">
        {providers.map((pv, i) => (
          <button
            key={pv.key}
            onClick={() => setSel(i)}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-extrabold transition-colors ${
              i === sel ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy/30"
            }`}
          >
            {pv.personal?.fullLegalName || `Provider ${i + 1}`}
          </button>
        ))}
      </div>
      <Card title="Personal"><Grid>
        <KV k="Full Legal Name" v={per.fullLegalName} /><KV k="Suffix" v={per.suffix} /><KV k="Other Names" v={per.otherNames} />
        <KV k="Date of Birth" v={per.dob} /><Secret k="SSN" v={per.ssn} /><KV k="Gender" v={per.gender} />
        <KV k="Place of Birth" v={per.placeOfBirth} /><KV k="Citizenship" v={per.citizenship} />
      </Grid></Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Contact"><Grid><KV k="Address" v={con.address} full /><KV k="Phone" v={con.phone} /><KV k="Email" v={con.email} /></Grid></Card>
        <Card title="Professional"><Grid><KV k="Provider Type" v={pro.providerType} /><KV k="Individual NPI" v={pro.npi} /><KV k="Taxonomy" v={(pro.taxonomies || []).map((t) => t.label).join(", ")} full /><KV k="Gov ID #" v={idn.govIdNumber} /></Grid></Card>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Licenses"><Grid><KV k="State License" v={lic.stateLicenseNumber} /><KV k="DEA" v={lic.deaNumber} /><KV k="Board Cert" v={lic.boardCertNumber} /><KV k="DOH License" v={lic.dohLicenseNumber} /></Grid></Card>
        <Card title="Credentialing"><Grid><KV k="CAQH User" v={cre.caqhUsername} /><Secret k="CAQH Pass" v={cre.caqhPassword} /><KV k="PECOS User" v={cre.pecosUsername} /><Secret k="PECOS Pass" v={cre.pecosPassword} /><KV k="PTANs" v={cre.ptans} /><KV k="Medicaid IDs" v={cre.medicaidIds} /></Grid></Card>
      </div>
      <Card title={`Provider Documents (${docs.length})`}><DocList docs={docs} onDoc={onDoc} /></Card>
    </div>
  );
}

/* ── System & Payer (editable, autosaved) ── */
function AccessTab({ access, setAccess }) {
  const systems = Array.isArray(access.systems) ? access.systems : [];
  const payers = Array.isArray(access.payers) ? access.payers : [];
  const setSystems = (n) => setAccess({ ...access, systems: n });
  const setPayers = (n) => setAccess({ ...access, payers: n });
  const upd = (arr, set, key, patch) => set(arr.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const nk = (p) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title="System Access">
        <CredRows rows={systems} nameLabel="Access Name" onUpd={(k, p) => upd(systems, setSystems, k, p)} onDel={(k) => setSystems(systems.filter((s) => s.key !== k))} />
        <AddRow onClick={() => setSystems([...systems, { key: nk("sys") }])} label="Add system access" />
      </Card>
      <Card title="Payer Portals" accent>
        <CredRows rows={payers} nameLabel="Payer Name" onUpd={(k, p) => upd(payers, setPayers, k, p)} onDel={(k) => setPayers(payers.filter((x) => x.key !== k))} />
        <AddRow onClick={() => setPayers([...payers, { key: nk("pay") }])} label="Add payer portal" />
      </Card>
    </div>
  );
}

function CredRows({ rows, nameLabel, onUpd, onDel }) {
  if (!rows.length) return <p className="mb-2 text-[12px] font-medium text-slate-400">None yet.</p>;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.key} className="rounded-xl border border-line bg-mist/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{nameLabel}</span>
            <button onClick={() => onDel(r.key)} className="grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"><CloseIcon size={13} /></button>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Input label={nameLabel} value={r.name || ""} onChange={(e) => onUpd(r.key, { name: e.target.value })} />
            <Input label="Link" value={r.link || ""} onChange={(e) => onUpd(r.key, { link: e.target.value })} placeholder="https://…" />
            <Input label="Username" value={r.username || ""} onChange={(e) => onUpd(r.key, { username: e.target.value })} autoComplete="off" />
            <Input label="Password" type="password" value={r.password || ""} onChange={(e) => onUpd(r.key, { password: e.target.value })} autoComplete="new-password" />
          </div>
        </div>
      ))}
    </div>
  );
}

function AddRow({ onClick, label }) {
  return (
    <button onClick={onClick} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2.5 text-[12px] font-extrabold text-slate-500 transition-colors hover:border-copper/50 hover:bg-copper/5 hover:text-copper-700">
      <PlusIcon size={13} /> {label}
    </button>
  );
}

/* ── Documents (grouped, download) ── */
function DocumentsTab({ documents, providers, onDoc }) {
  const facilityDocs = documents.filter((d) => d.scope === "facility");
  return (
    <div className="space-y-4">
      <Card title={`Facility Documents (${facilityDocs.length})`}><DocList docs={facilityDocs} onDoc={onDoc} /></Card>
      {providers.map((p, i) => {
        const docs = documents.filter((d) => d.scope === "provider" && d.provider_key === p.key);
        return <Card key={p.key} title={`${p.personal?.fullLegalName || `Provider ${i + 1}`} — Documents (${docs.length})`}><DocList docs={docs} onDoc={onDoc} /></Card>;
      })}
    </div>
  );
}

function DocList({ docs, onDoc }) {
  if (!docs.length) return <p className="text-[12px] font-medium text-slate-400">No documents.</p>;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {docs.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-bold text-navy">{d.doc_type}</p>
            <p className="truncate text-[10px] font-medium text-slate-400">{d.filename} · {formatBytes(d.size_bytes)}</p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button onClick={() => onDoc(d.id, false)} className="rounded-lg border border-line px-2 py-1 text-[10px] font-extrabold text-slate-500 hover:border-navy/30 hover:bg-navy hover:text-white">View</button>
            <button onClick={() => onDoc(d.id, true)} className="rounded-lg border border-copper/40 px-2 py-1 text-[10px] font-extrabold text-copper-700 hover:bg-copper hover:text-white">Download</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── overview / states ── */
function OverviewStrip({ client, draft, providers, documents, users, status }) {
  const tiles = [
    { label: "Onboarding", value: status.label, tone: status.tone },
    { label: "Providers", value: providers.length },
    { label: "Documents", value: (documents || []).length },
    { label: "Users", value: (users || []).length },
    { label: "Reference", value: draft?.reference_code || "—", mono: true },
  ];
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.label} className="relative overflow-hidden rounded-xl2 border border-navy/10 bg-white p-3.5 shadow-crisp ring-1 ring-inset ring-line">
          <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-navy-700 via-copper to-navy-700 opacity-80" />
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{t.label}</p>
          <p className={`mt-1 truncate text-lg font-extrabold tracking-tight text-navy ${t.mono ? "font-mono text-base" : ""}`}>{t.value}</p>
        </div>
      ))}
    </div>
  );
}

function NotStarted() {
  return (
    <div className="rounded-xl2 border-2 border-dashed border-line bg-white p-14 text-center shadow-crisp">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-mist text-copper-700">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" /><path d="M12 8v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="text-base font-extrabold text-navy">Onboarding not started</p>
      <p className="mx-auto mt-1 max-w-md text-sm font-medium text-slate-400">
        This client hasn&apos;t begun their onboarding yet. Their facility, provider, access and document
        details will appear here in real time as they complete each step.
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl2 bg-white/70 ring-1 ring-inset ring-line" />)}
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl2 border border-line bg-white shadow-crisp">
          <div className="h-10 animate-pulse bg-mist/70" />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, j) => <div key={j} className="h-8 animate-pulse rounded-lg bg-mist/60" />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── shared bits ── */
function Card({ title, accent, children }) {
  return (
    <section className="overflow-hidden rounded-xl2 border border-navy/10 bg-white shadow-crisp ring-1 ring-inset ring-line">
      <header className={`border-b border-line px-5 py-2.5 ${accent ? "bg-copper/5" : "bg-mist/50"}`}>
        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-copper-700">{title}</h3>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
function Grid({ children }) { return <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>; }
function KV({ k, v, full }) {
  return (
    <div className={`min-w-0 ${full ? "sm:col-span-2 lg:col-span-3" : ""}`}>
      <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{k}</dt>
      <dd className="mt-0.5 break-words text-[13px] font-bold text-navy">{v || <span className="font-medium text-slate-300">—</span>}</dd>
    </div>
  );
}
function Secret({ k, v, full }) {
  const [show, setShow] = useState(false);
  return (
    <div className={`min-w-0 ${full ? "sm:col-span-2 lg:col-span-3" : ""}`}>
      <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{k}</dt>
      <dd className="mt-0.5 flex items-center gap-2">
        <span className="break-all text-[13px] font-bold text-navy">{!v ? <span className="font-medium text-slate-300">—</span> : show ? v : "•".repeat(Math.min(String(v).length, 12))}</span>
        {v && <button onClick={() => setShow((s) => !s)} className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] font-extrabold text-slate-500 hover:text-copper-700">{show ? "Hide" : "Show"}</button>}
      </dd>
    </div>
  );
}
function Empty({ children }) { return <div className="rounded-xl2 border border-dashed border-line bg-white p-10 text-center text-sm font-medium text-slate-400">{children}</div>; }
function SaveBadge({ state }) {
  const m = { idle: ["bg-white/30", "Live"], saving: ["bg-amber-400", "Saving…"], saved: ["bg-emerald-400", "Saved"], error: ["bg-rose-400", "Error"] }[state] || ["bg-white/30", "Live"];
  return <span className="hidden items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-extrabold text-white sm:inline-flex"><span className={`h-1.5 w-1.5 rounded-full ${m[0]} ${state === "saving" ? "animate-pulse" : ""}`} />{m[1]}</span>;
}
function formatBytes(n) { if (!n) return "0 B"; const k = 1024, u = ["B", "KB", "MB", "GB"], i = Math.floor(Math.log(n) / Math.log(k)); return `${(n / k ** i).toFixed(i ? 1 : 0)} ${u[i]}`; }
