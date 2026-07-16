"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ONBOARDING_STATUS, SOW_OPTIONS, SYSTEM_ACCESS_OPTIONS, labelsFor } from "@/lib/domain";
import ClientDetailPanel from "./ClientDetailPanel";
import EditClientModal from "./EditClientModal";

const HEADERS = [
  "Client ID",
  "Client Name",
  "Specialty",
  "Scope of Work",
  "Access Granted",
  "Status",
  "Action",
];

const STATUS_TONE = {
  slate: "bg-slate-100 text-slate-600",
  amber: "bg-amber-100 text-amber-700",
  sky: "bg-sky-100 text-sky-700",
  emerald: "bg-emerald-100 text-emerald-700",
};

export default function ClientsTable({ clients }) {
  const router = useRouter();
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);

  // On save the API returns the freshly-shaped client. Update the open detail
  // panel in place so the change shows immediately, and refresh the server
  // component so the table row (and stats) re-render with the same shape.
  function onSaved(updated) {
    if (updated) {
      setViewing((v) => (v && v.id === updated.id ? updated : v));
    }
    setEditing(null);
    router.refresh();
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl2 border border-line bg-white shadow-crisp">
        {/* Wide table: scrolls within its own container so the page never
            scrolls sideways on narrow screens. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-copper/60 bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900">
                {HEADERS.map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-white"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {clients.length === 0 && (
                <tr>
                  <td colSpan={HEADERS.length} className="px-4 py-14 text-center">
                    <p className="text-sm font-bold text-navy">No clients yet</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Use “Create Client” to register the first organization.
                    </p>
                  </td>
                </tr>
              )}

              {clients.map((c, i) => (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.2) }}
                  className="group transition-colors hover:bg-mist/50"
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="rounded-md bg-navy/[0.06] px-1.5 py-0.5 font-mono text-[11px] font-bold text-navy">
                      {c.client_code}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[13px] font-bold leading-tight text-navy">{c.name}</p>
                    {c.contact_person && (
                      <p className="text-[11px] font-medium text-slate-400">{c.contact_person}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] font-medium text-slate-600">
                    {c.specialty || <Dash />}
                  </td>
                  <td className="px-4 py-3">
                    <Chips values={labelsFor(SOW_OPTIONS, c.scope_of_work)} />
                  </td>
                  <td className="px-4 py-3">
                    {c.system_access?.length ? (
                      <Chips values={labelsFor(SYSTEM_ACCESS_OPTIONS, c.system_access)} tone="copper" />
                    ) : (
                      <Dash />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusPill value={c.onboarding_status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setViewing(c)}
                        className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-extrabold text-slate-500 transition-colors hover:border-copper/40 hover:bg-copper hover:text-white"
                      >
                        View
                      </button>
                      <button
                        onClick={() => setEditing(c)}
                        className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-extrabold text-slate-500 transition-colors hover:border-navy/30 hover:bg-navy hover:text-white"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ClientDetailPanel
        client={viewing}
        onClose={() => setViewing(null)}
        onEdit={(c) => setEditing(c)}
      />

      <EditClientModal
        open={!!editing}
        client={editing}
        onClose={() => setEditing(null)}
        onSaved={onSaved}
        // Adding/removing users must refresh the row's user count without
        // closing the modal the admin is still working in.
        onUsersChanged={() => router.refresh()}
      />
    </>
  );
}

function StatusPill({ value }) {
  const meta = ONBOARDING_STATUS.find((s) => s.value === value) ?? ONBOARDING_STATUS[0];
  return (
    <span className={`status-pill ${STATUS_TONE[meta.tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {meta.label}
    </span>
  );
}

/** Shows the first two values inline and collapses the rest into a +N chip. */
function Chips({ values, tone = "navy" }) {
  if (!values?.length) return <Dash />;
  const shown = values.slice(0, 2);
  const rest = values.length - shown.length;
  const cls =
    tone === "copper"
      ? "bg-copper/10 text-copper-700"
      : "bg-navy/[0.06] text-navy";
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((v) => (
        <span key={v} className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>
          {v}
        </span>
      ))}
      {rest > 0 && (
        <span
          className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500"
          title={values.join(", ")}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

function Dash() {
  return <span className="text-[12px] font-medium text-slate-300">—</span>;
}
