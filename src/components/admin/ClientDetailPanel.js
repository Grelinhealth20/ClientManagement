"use client";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ONBOARDING_STATUS,
  SOW_OPTIONS,
  SYSTEM_ACCESS_OPTIONS,
  isSaasClient,
  labelsFor,
} from "@/lib/domain";
import { CloseIcon, EditIcon } from "@/components/icons";

/**
 * Full-window panel for the table's View action.
 *
 * Shows the client's registered profile, and reserves the section that will
 * show what the client submitted through the onboarding panel. That panel does
 * not exist yet, so this states plainly that nothing has been submitted rather
 * than inventing content — see the note in the onboarding section below.
 */
export default function ClientDetailPanel({ client, onClose, onEdit }) {
  useEffect(() => {
    if (!client) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    // The panel covers the page; stop the page behind it scrolling.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [client, onClose]);

  const status =
    ONBOARDING_STATUS.find((s) => s.value === client?.onboarding_status) ?? ONBOARDING_STATUS[0];

  return (
    <AnimatePresence>
      {client && (
        <motion.div
          className="fixed inset-0 z-[70] flex flex-col bg-mist"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-label={`${client.name} details`}
        >
          <header className="shrink-0 border-b border-line bg-white">
            <div className="h-0.5 w-full bg-gradient-to-r from-navy-700 via-copper to-navy-700" />
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-bold text-copper-700">
                  {client.client_code}
                </p>
                <h2 className="truncate text-lg font-extrabold tracking-tight text-navy">
                  {client.name}
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {onEdit && (
                  <button
                    onClick={() => onEdit(client)}
                    className="flex items-center gap-1.5 rounded-lg border border-navy/20 bg-navy px-3 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-navy-700"
                  >
                    <EditIcon size={14} />
                    Edit
                  </button>
                )}
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-bold text-slate-500 transition-colors hover:bg-mist hover:text-navy"
                >
                  <CloseIcon size={14} />
                  Close
                </button>
              </div>
            </div>
          </header>

          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 overflow-y-auto"
          >
            <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card title="Profile" className="lg:col-span-2">
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <Row label="Client ID" value={client.client_code} mono />
                    <Row label="Client Name" value={client.name} />
                    <Row label="Company" value={client.company} />
                    <Row label="Specialty" value={client.specialty} />
                    <Row label="Start Date" value={formatDate(client.start_date)} />
                    <Row label="Email ID" value={client.email} />
                    <Row label="Contact Person" value={client.contact_person} />
                    <Row label="Phone Number" value={client.phone} />
                    <Row label="Account Status" value={titleCase(client.status)} />
                  </dl>
                </Card>

                <Card title="Onboarding Status">
                  <p className="text-2xl font-extrabold tracking-tight text-navy">{status.label}</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    Set from the client&apos;s own onboarding submissions.
                  </p>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card title="Scope of Work">
                  <TagList values={labelsFor(SOW_OPTIONS, client.scope_of_work)} />
                </Card>
                <Card title="Access Granted">
                  {isSaasClient(client.scope_of_work) ? (
                    <TagList
                      values={labelsFor(SYSTEM_ACCESS_OPTIONS, client.system_access)}
                      tone="copper"
                      empty="No system access granted."
                    />
                  ) : (
                    <p className="text-xs font-medium text-slate-400">
                      System access applies to SaaS clients only.
                    </p>
                  )}
                </Card>
              </div>

              <Card title="Onboarding submission">
                {/* Honest empty state: the client-side onboarding panel is not
                    built yet, so there is genuinely nothing submitted to show.
                    Wire this to the submission record once that panel exists. */}
                <div className="rounded-xl border border-dashed border-line bg-mist/50 px-4 py-10 text-center">
                  <p className="text-sm font-bold text-navy">Nothing submitted yet</p>
                  <p className="mx-auto mt-1 max-w-md text-xs font-medium text-slate-400">
                    This client has not completed the onboarding panel. Their answers will appear
                    here once the client-side onboarding panel is built and they submit it.
                  </p>
                </div>
              </Card>

              {client.notes && (
                <Card title="Notes">
                  <p className="whitespace-pre-wrap text-[13px] font-medium text-slate-600">
                    {client.notes}
                  </p>
                </Card>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Card({ title, className = "", children }) {
  return (
    <section className={`rounded-xl2 border border-line bg-white p-5 shadow-crisp ${className}`}>
      <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-copper-700">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
        {label}
      </dt>
      <dd
        className={`mt-0.5 truncate text-[13px] font-bold text-navy ${mono ? "font-mono" : ""}`}
      >
        {value || <span className="font-sans font-medium text-slate-300">—</span>}
      </dd>
    </div>
  );
}

function TagList({ values, tone = "navy", empty = "None selected." }) {
  if (!values?.length) {
    return <p className="text-xs font-medium text-slate-400">{empty}</p>;
  }
  const cls = tone === "copper" ? "bg-copper/10 text-copper-700" : "bg-navy/[0.06] text-navy";
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <span key={v} className={`rounded-lg px-2 py-1 text-[11px] font-bold ${cls}`}>
          {v}
        </span>
      ))}
    </div>
  );
}

function formatDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function titleCase(v = "") {
  return v.replace(/\b\w/g, (c) => c.toUpperCase());
}
