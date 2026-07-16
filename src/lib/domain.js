// Single source of truth for the client-profile vocabulary. The Create Client
// form, the API validators and the clients table all read from here so a new
// service can never be offered in the UI but rejected by the API.

// Scope of Work — what Grelin does for the client.
export const SOW_OPTIONS = [
  { value: "end_to_end_billing", label: "End to End Billing" },
  { value: "eligibility_verification", label: "Eligibility Verification" },
  { value: "coding", label: "Coding" },
  { value: "chart_auditing", label: "Chart Auditing" },
  { value: "claims_status_verification", label: "Claims Status Verification" },
  { value: "credentialing", label: "Credentialing" },
  { value: "saas_client", label: "SaaS Client" },
];

// Selecting this in the scope of work turns the client into a SaaS client,
// which unlocks the System Access picker.
export const SAAS_SOW_VALUE = "saas_client";

// System Access — the modules a SaaS client may use. Only meaningful when
// SAAS_SOW_VALUE is part of the scope of work.
export const SYSTEM_ACCESS_OPTIONS = [
  { value: "eligibility_verification", label: "Eligibility Verification" },
  { value: "claims_status_verification", label: "Claims Status Verification" },
  { value: "charge_entry", label: "Charge Entry" },
  { value: "coding", label: "Coding" },
  { value: "ar_denial_management", label: "AR & Denial Management" },
  { value: "patient_statements", label: "Patient Statements" },
];

// Onboarding status shown in the clients table. Driven by the client's own
// onboarding submissions rather than set by an admin, so it stays at
// 'not_started' until the client-side onboarding panel is built.
export const ONBOARDING_STATUS = [
  { value: "not_started", label: "Not Started", tone: "slate" },
  { value: "in_progress", label: "In Progress", tone: "amber" },
  { value: "submitted", label: "Submitted", tone: "sky" },
  { value: "completed", label: "Completed", tone: "emerald" },
];

const valuesOf = (opts) => opts.map((o) => o.value);

export const SOW_VALUES = valuesOf(SOW_OPTIONS);
export const SYSTEM_ACCESS_VALUES = valuesOf(SYSTEM_ACCESS_OPTIONS);
export const ONBOARDING_STATUS_VALUES = valuesOf(ONBOARDING_STATUS);

export function labelFor(options, value) {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function labelsFor(options, values) {
  if (!Array.isArray(values)) return [];
  return values.map((v) => labelFor(options, v));
}

export function isSaasClient(scopeOfWork) {
  return Array.isArray(scopeOfWork) && scopeOfWork.includes(SAAS_SOW_VALUE);
}

/** Keep only recognised values, de-duplicated and in a stable order. */
export function sanitizeList(allowed, values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set(values.filter((v) => allowed.includes(v)));
  return allowed.filter((v) => seen.has(v));
}

/**
 * A client's granted system access is only meaningful for SaaS clients.
 * Non-SaaS clients must not carry stale access from a deselected SaaS box.
 */
export function sanitizeSystemAccess(scopeOfWork, systemAccess) {
  if (!isSaasClient(scopeOfWork)) return [];
  return sanitizeList(SYSTEM_ACCESS_VALUES, systemAccess);
}
