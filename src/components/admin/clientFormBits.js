"use client";
import { AnimatePresence, motion } from "framer-motion";
import Button from "@/components/ui/Button";
import { SYSTEM_ACCESS_OPTIONS } from "@/lib/domain";
import { CloseIcon } from "@/components/icons";

// Presentational bits shared by CreateClientModal and EditClientModal so the two
// forms can never drift on how a field, a check card or the SaaS system-access
// popup looks and behaves.

export function Fieldset({ legend, hint, required, children }) {
  return (
    <fieldset>
      <legend className="text-[11px] font-extrabold uppercase tracking-wider text-copper-700">
        {legend}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </legend>
      {hint && <p className="mt-0.5 text-[11px] font-medium text-slate-400">{hint}</p>}
      <div className="mt-2">{children}</div>
    </fieldset>
  );
}

export function CheckCard({ checked, onChange, label, sub, accent }) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
        checked
          ? accent
            ? "border-copper bg-copper/10"
            : "border-navy/30 bg-navy/[0.04]"
          : "border-line bg-white hover:border-slate-300"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 shrink-0 accent-navy"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-bold leading-tight text-navy">{label}</span>
        {sub && <span className="block text-[11px] font-medium text-slate-400">{sub}</span>}
      </span>
    </label>
  );
}

/** Small popup for choosing the System Access a SaaS client may use. */
export function SystemAccessPopup({ open, selected, onToggle, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="System access"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="card relative z-10 w-full max-w-md overflow-hidden"
          >
            <div className="flex items-start justify-between border-b border-line px-5 py-4">
              <div>
                <h3 className="text-base font-extrabold text-navy">System Access</h3>
                <p className="mt-0.5 text-xs text-slate-500">Modules this SaaS client may use.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close system access"
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-mist hover:text-navy"
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="space-y-2 px-5 py-4">
              {SYSTEM_ACCESS_OPTIONS.map((o) => (
                <CheckCard
                  key={o.value}
                  checked={selected.includes(o.value)}
                  onChange={() => onToggle(o.value)}
                  label={o.label}
                />
              ))}
            </div>
            <div className="flex justify-end border-t border-line px-5 py-3">
              <Button type="button" onClick={onClose}>
                Done
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
