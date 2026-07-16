"use client";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Button from "@/components/ui/Button";
import { PlusIcon } from "@/components/icons";
import { SectionPanel } from "./ui";

// The common systems every facility usually has — seeded once so the table
// starts pre-filled with the names to complete.
const DEFAULT_SYSTEM_NAMES = ["PMS / EMR", "EHR", "Clearinghouse"];

const SystemIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" strokeLinecap="round" />
  </svg>
);
const PayerIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M2.5 10h19M6 14h4" strokeLinecap="round" />
  </svg>
);

let seq = 0;
const newKey = (p) => `${p}-${Date.now().toString(36)}-${++seq}`;

export default function StepSystemAccess({ systemAccess, setSystemAccess }) {
  const sa = systemAccess || {};
  const systems = Array.isArray(sa.systems) ? sa.systems : [];
  const payers = Array.isArray(sa.payers) ? sa.payers : [];

  // Seed PMS/EMR, EHR, Clearinghouse the first time this step is opened. Guarded
  // on `systems` being undefined (never initialized) — so if the user deliberately
  // removes them, they are NOT re-seeded.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (sa.systems === undefined) {
      seededRef.current = true;
      setSystemAccess({
        ...sa,
        systems: DEFAULT_SYSTEM_NAMES.map((name, i) => ({
          key: `sys-seed-${i}`,
          name,
        })),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sa.systems]);

  const setSystems = (next) => setSystemAccess({ ...sa, systems: next });
  const setPayers = (next) => setSystemAccess({ ...sa, payers: next });

  const addSystem = () => setSystems([...systems, { key: newKey("sys") }]);
  const updateSystem = (key, patch) => setSystems(systems.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const removeSystem = (key) => setSystems(systems.filter((s) => s.key !== key));

  const addPayer = () => setPayers([...payers, { key: newKey("pay") }]);
  const updatePayer = (key, patch) => setPayers(payers.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const removePayer = (key) => setPayers(payers.filter((p) => p.key !== key));

  return (
    <div className="space-y-4">
      {/* ── System Access table ── */}
      <SectionPanel
        title="System Access"
        icon={SystemIcon}
        right={
          <Button onClick={addSystem} className="gap-1.5 !px-3 !py-1.5 !text-[12px]">
            <PlusIcon size={13} /> Add System Access
          </Button>
        }
      >
        <CredTable
          nameHeader="Access Name"
          namePlaceholder="e.g. PMS / EMR, EHR, Clearinghouse"
          rows={systems}
          onUpdate={updateSystem}
          onRemove={removeSystem}
          onAdd={addSystem}
          emptyLabel="No system access added yet"
        />
      </SectionPanel>

      {/* ── Payer Portal table ── */}
      <SectionPanel
        title="Payer Portals"
        icon={PayerIcon}
        right={
          <Button onClick={addPayer} className="gap-1.5 !px-3 !py-1.5 !text-[12px]">
            <PlusIcon size={13} /> Add Payer Portals
          </Button>
        }
      >
        <CredTable
          nameHeader="Payer Name"
          namePlaceholder="e.g. Aetna, Cigna, UnitedHealthcare"
          rows={payers}
          onUpdate={updatePayer}
          onRemove={removePayer}
          onAdd={addPayer}
          emptyLabel="No payer portals added yet"
        />
      </SectionPanel>
    </div>
  );
}

/**
 * Shared 3-column credential table (Name | User Name | Password) with inline,
 * real-time editable cells. Headers stay visible even with no rows.
 */
function CredTable({ nameHeader, namePlaceholder, rows, onUpdate, onRemove, onAdd, emptyLabel }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b-2 border-line bg-gradient-to-b from-mist to-white">
            <th className="px-4 py-3.5 text-center text-[12px] font-extrabold uppercase tracking-wider text-navy">{nameHeader}</th>
            <th className="px-4 py-3.5 text-center text-[12px] font-extrabold uppercase tracking-wider text-navy">User Name</th>
            <th className="px-4 py-3.5 text-center text-[12px] font-extrabold uppercase tracking-wider text-navy">Password</th>
            <th className="w-14 px-4 py-3.5" aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-12 text-center">
                <p className="text-sm font-bold text-navy">{emptyLabel}</p>
                <button
                  type="button"
                  onClick={onAdd}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-[12px] font-extrabold text-slate-500 transition-colors hover:border-copper/50 hover:bg-copper/5 hover:text-copper-700"
                >
                  <PlusIcon size={13} /> Add a row
                </button>
              </td>
            </tr>
          )}

          <AnimatePresence initial={false}>
            {rows.map((r) => (
              <motion.tr
                key={r.key}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="align-middle"
              >
                <td className="px-3 py-2.5">
                  <input
                    className="input-base"
                    value={r.name || ""}
                    onChange={(e) => onUpdate(r.key, { name: e.target.value })}
                    placeholder={namePlaceholder}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <input
                    className="input-base"
                    value={r.username || ""}
                    onChange={(e) => onUpdate(r.key, { username: e.target.value })}
                    placeholder="Username"
                    autoComplete="off"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <input
                    className="input-base"
                    type="password"
                    value={r.password || ""}
                    onChange={(e) => onUpdate(r.key, { password: e.target.value })}
                    placeholder="Password"
                    autoComplete="new-password"
                  />
                </td>
                <td className="px-3 py-2.5 text-center">
                  <button
                    type="button"
                    onClick={() => onRemove(r.key)}
                    aria-label="Remove row"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-line text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
