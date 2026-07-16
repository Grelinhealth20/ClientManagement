"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Button from "@/components/ui/Button";
import { PlusIcon } from "@/components/icons";
import ProviderFields, { blankProvider } from "./ProviderFields";
import DocumentUpload from "./DocumentUpload";
import ProviderLinkModal from "./ProviderLinkModal";

let providerSeq = 0;
const newKey = () => `prov-${Date.now().toString(36)}-${++providerSeq}`;

const HEADERS = ["Provider Name", "NPI", "CAQH Login", "PECOS", "Application Status", "Action"];

// The fields that count toward "% information collected" for a provider.
function completeness(p) {
  const per = p.personal || {}, con = p.contact || {}, idn = p.identification || {};
  const pro = p.professional || {}, lic = p.licenses || {}, cre = p.credentialing || {};
  const vals = [
    per.fullLegalName, per.dob, per.ssn, per.gender, per.placeOfBirth, per.citizenship,
    con.address, con.phone, con.email,
    idn.govIdNumber,
    pro.providerType, pro.npi, pro.taxonomies?.length ? "x" : "",
    lic.stateLicenseNumber, lic.deaNumber, lic.boardCertNumber, lic.dohLicenseNumber,
    cre.caqhUsername, cre.caqhPassword, cre.pecosUsername, cre.pecosPassword, cre.ptans, cre.medicaidIds,
  ];
  const filled = vals.filter((v) => v && String(v).trim()).length;
  return Math.round((filled / vals.length) * 100);
}

const mask = (v) => (v ? "•".repeat(Math.min(String(v).length, 10)) : null);

export default function StepProviders({ providers, setProviders, documents, onUploaded, onRemoved }) {
  const list = Array.isArray(providers) ? providers : [];
  const [mode, setMode] = useState("list"); // list | form
  const [editingKey, setEditingKey] = useState(null);
  const [linkFor, setLinkFor] = useState(null);

  const editing = list.find((p) => p.key === editingKey) || null;

  function addProvider() {
    const p = blankProvider(newKey());
    setProviders([...list, p]);
    setEditingKey(p.key);
    setMode("form");
  }
  function openView(key) {
    setEditingKey(key);
    setMode("form");
  }
  function updateProvider(key, next) {
    setProviders(list.map((p) => (p.key === key ? next : p)));
  }
  function removeProvider(key) {
    setProviders(list.filter((p) => p.key !== key));
    if (editingKey === key) {
      setEditingKey(null);
      setMode("list");
    }
  }
  function backToList() {
    setMode("list");
    setEditingKey(null);
  }

  // ── Form view — only visible after Add Provider / View ──
  if (mode === "form" && editing) {
    const name = editing.personal?.fullLegalName || "New Provider";
    return (
      <section className="overflow-hidden rounded-xl2 border border-navy/10 bg-white shadow-elev ring-1 ring-inset ring-line">
        <header className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 px-5 py-3">
          <button
            type="button"
            onClick={backToList}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-[12px] font-extrabold text-white transition-colors hover:bg-white hover:text-navy"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            All Providers
          </button>
          <div className="min-w-0 flex-1 px-2 text-center">
            <p className="truncate text-[13px] font-extrabold uppercase tracking-wider text-white">{name}</p>
            <p className="text-[11px] font-semibold text-white/55">{completeness(editing)}% information collected</p>
          </div>
          <button
            type="button"
            onClick={() => setLinkFor(editing)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-[12px] font-extrabold text-white transition-colors hover:bg-copper"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" strokeLinecap="round" />
              <path d="M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            External Invite
          </button>
        </header>
        <div className="h-0.5 w-full bg-gradient-to-r from-copper/70 via-copper to-copper/70" />
        <div className="p-5">
          <ProviderFields
            provider={editing}
            onChange={(next) => updateProvider(editing.key, next)}
            renderDoc={(docType, category) => (
              <DocumentUpload
                key={docType}
                label={docType}
                category={category}
                scope="provider"
                providerKey={editing.key}
                providerName={editing.personal?.fullLegalName || name}
                files={documents.filter((d) => d.scope === "provider" && d.provider_key === editing.key && d.doc_type === docType)}
                onUploaded={onUploaded}
                onRemoved={onRemoved}
              />
            )}
          />
          <div className="mt-5 flex justify-between gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => removeProvider(editing.key)}
              className="rounded-xl border border-line px-4 py-2 text-[13px] font-bold text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            >
              Remove provider
            </button>
            <Button onClick={backToList}>Done — back to list</Button>
          </div>
        </div>
        <ProviderLinkModal open={!!linkFor} provider={linkFor} onClose={() => setLinkFor(null)} />
      </section>
    );
  }

  // ── Table view (default) ──
  return (
    <section className="overflow-hidden rounded-xl2 border border-navy/10 bg-white shadow-elev ring-1 ring-inset ring-line">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-copper ring-1 ring-inset ring-white/15">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="8" r="3.2" />
              <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.2a3.2 3.2 0 0 1 0 6M17.5 20a5.5 5.5 0 0 0-3-4.9" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <h3 className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-white">Provider Information</h3>
            <p className="text-[11px] font-semibold text-white/55">
              {list.length} provider{list.length === 1 ? "" : "s"} · each gets a document subfolder
            </p>
          </div>
        </div>
        <Button onClick={addProvider} className="gap-1.5">
          <PlusIcon size={14} /> Add Provider
        </Button>
      </header>
      <div className="h-0.5 w-full bg-gradient-to-r from-copper/70 via-copper to-copper/70" />

      {/* Table — bold, dark, centered headers; always visible even with no data */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse">
          <thead>
            <tr className="border-b-2 border-line bg-gradient-to-b from-mist to-white">
              {HEADERS.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="whitespace-nowrap px-5 py-4 text-center text-[12px] font-extrabold uppercase tracking-wider text-navy"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.length === 0 && (
              <tr>
                <td colSpan={HEADERS.length} className="px-4 py-14 text-center">
                  <p className="text-sm font-bold text-navy">No providers added yet</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Click <span className="font-bold text-copper-700">Add Provider</span> to enter a provider, or invite them externally.
                  </p>
                </td>
              </tr>
            )}

            <AnimatePresence initial={false}>
              {list.map((p, i) => {
                const pct = completeness(p);
                const cre = p.credentialing || {};
                const name = p.personal?.fullLegalName || `Provider ${i + 1}`;
                return (
                  <motion.tr
                    key={p.key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="group text-center align-middle transition-colors hover:bg-mist/50"
                  >
                    {/* Provider Name */}
                    <td className="px-5 py-4">
                      <button type="button" onClick={() => openView(p.key)} className="mx-auto flex items-center justify-center gap-2">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-[11px] font-extrabold text-white">{i + 1}</span>
                        <span className="min-w-0 text-left">
                          <span className="block truncate text-[13px] font-extrabold text-navy group-hover:text-copper-700">{name}</span>
                          {p._source === "external" && (
                            <span className="mt-0.5 inline-block rounded bg-copper/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-copper-700">
                              External
                            </span>
                          )}
                        </span>
                      </button>
                    </td>
                    {/* NPI */}
                    <td className="px-5 py-4 text-center font-mono text-[12px] font-bold text-navy">
                      {p.professional?.npi || <Dash />}
                    </td>
                    {/* CAQH */}
                    <td className="px-5 py-4">
                      <div className="flex justify-center">
                        <Creds user={cre.caqhUsername} pass={cre.caqhPassword} />
                      </div>
                    </td>
                    {/* PECOS */}
                    <td className="px-5 py-4">
                      <div className="flex justify-center">
                        <Creds user={cre.pecosUsername} pass={cre.pecosPassword} />
                      </div>
                    </td>
                    {/* Application Status */}
                    <td className="px-5 py-4">
                      <div className="mx-auto w-[160px]">
                        <Progress pct={pct} />
                      </div>
                    </td>
                    {/* Action */}
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openView(p.key)}
                          className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-extrabold text-slate-500 transition-colors hover:border-navy/30 hover:bg-navy hover:text-white"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => setLinkFor(p)}
                          className="rounded-lg border border-copper/40 px-2.5 py-1 text-[11px] font-extrabold text-copper-700 transition-colors hover:bg-copper hover:text-white"
                        >
                          Invite
                        </button>
                        <button
                          type="button"
                          onClick={() => removeProvider(p.key)}
                          aria-label="Remove provider"
                          className="grid h-7 w-7 place-items-center rounded-lg border border-line text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <ProviderLinkModal open={!!linkFor} provider={linkFor} onClose={() => setLinkFor(null)} />
    </section>
  );
}

function Creds({ user, pass }) {
  if (!user && !pass) return <Dash />;
  return (
    <div className="space-y-0.5 text-[11px] leading-tight">
      <div className="flex items-center gap-1">
        <span className="w-8 shrink-0 font-semibold text-slate-400">User</span>
        <span className="truncate font-bold text-navy">{user || "—"}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-8 shrink-0 font-semibold text-slate-400">Pass</span>
        <span className="truncate font-mono font-bold text-slate-500">{mask(pass) || "—"}</span>
      </div>
    </div>
  );
}

function Progress({ pct }) {
  const tone = pct >= 100 ? "emerald" : pct >= 50 ? "copper" : "slate";
  const barCls =
    tone === "emerald" ? "from-emerald-500 to-emerald-600" : tone === "copper" ? "from-copper to-navy" : "from-slate-400 to-slate-500";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={`text-[11px] font-extrabold ${pct >= 100 ? "text-emerald-600" : pct >= 50 ? "text-copper-700" : "text-slate-500"}`}>
          {pct}%
        </span>
        <span className="text-[10px] font-semibold text-slate-400">{pct >= 100 ? "Complete" : "In progress"}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${barCls}`}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
        />
      </div>
    </div>
  );
}

function Dash() {
  return <span className="text-[12px] font-medium text-slate-300">—</span>;
}
