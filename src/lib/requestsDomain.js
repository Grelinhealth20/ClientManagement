// Single source of truth for the Client Requests & Enrollment module vocabulary.
// The admin builder, the client dashboard, the API validators and the tables
// all read from here so the UI and API can never drift on allowed values.

// ── Checklist request lifecycle ──────────────────────────────────────────────
export const CHECKLIST_STATUS = [
  { value: "pending", label: "Pending", tone: "amber" },
  { value: "completed", label: "Completed", tone: "emerald" },
];

// ── Enrollment status (per payer, per facility/provider) ─────────────────────
export const ENROLLMENT_STATUS = [
  { value: "not_started", label: "Not Started", tone: "slate" },
  { value: "in_progress", label: "In Progress", tone: "amber" },
  { value: "submitted", label: "Submitted", tone: "sky" },
  { value: "approved", label: "Approved", tone: "emerald" },
  { value: "denied", label: "Denied", tone: "rose" },
  { value: "on_hold", label: "On Hold", tone: "violet" },
  { value: "completed", label: "Completed", tone: "emerald" },
];

// Enrollment scope — a payer row belongs either to the facility as a whole or
// to a single individual provider.
export const ENROLLMENT_SCOPE = ["facility", "provider"];

// ── Support ticket lifecycle (Request from Client) ───────────────────────────
export const TICKET_STATUS = [
  { value: "open", label: "Open", tone: "sky" },
  { value: "in_progress", label: "In Progress", tone: "amber" },
  { value: "resolved", label: "Resolved", tone: "emerald" },
  { value: "closed", label: "Closed", tone: "slate" },
];

// The request categories a client may tick when raising a new request. Multiple
// may apply to one ticket.
export const TICKET_CATEGORY = [
  { value: "new_provider_onboarding", label: "New Provider Onboarding" },
  { value: "other_request", label: "Other Request" },
];

const valuesOf = (opts) => opts.map((o) => o.value);

export const CHECKLIST_STATUS_VALUES = valuesOf(CHECKLIST_STATUS);
export const ENROLLMENT_STATUS_VALUES = valuesOf(ENROLLMENT_STATUS);
export const TICKET_STATUS_VALUES = valuesOf(TICKET_STATUS);
export const TICKET_CATEGORY_VALUES = valuesOf(TICKET_CATEGORY);

export function metaFor(options, value) {
  return options.find((o) => o.value === value) ?? options[0];
}

export function labelFor(options, value) {
  return options.find((o) => o.value === value)?.label ?? value;
}

// Tailwind tone → pill classes, shared by every status badge in the module.
export const TONE_CLASS = {
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  amber: "bg-amber-100 text-amber-700 ring-amber-200",
  sky: "bg-sky-100 text-sky-700 ring-sky-200",
  emerald: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  rose: "bg-rose-100 text-rose-700 ring-rose-200",
  violet: "bg-violet-100 text-violet-700 ring-violet-200",
  navy: "bg-navy/[0.06] text-navy ring-navy/15",
};

/** Format any date value as mm/dd/yyyy (module-wide UI date format). */
export function fmtDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/** Format a date value as mm/dd/yyyy hh:mm AM/PM for timestamped notes. */
export function fmtDateTime(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${fmtDate(d)} ${h}:${mm} ${ampm}`;
}
