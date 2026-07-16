import { decrypt } from "./crypto.js";

// Columns every caller needs to build a client object. Kept here so the API and
// the server-rendered Control Center cannot drift apart on what they select.
export const CLIENT_COLUMNS = `
  c.id, c.client_code, c.name, c.company, c.specialty, c.scope_of_work,
  c.system_access, c.email, c.contact_person, c.phone_enc, c.start_date,
  c.status, c.onboarding_status, c.notes, c.created_at, c.updated_at
`;

/**
 * Shape a `clients` row for the UI, decrypting the phone and normalising the
 * JSON columns.
 */
export function toClient(c) {
  return {
    id: c.id,
    client_code: c.client_code,
    name: c.name,
    company: c.company,
    specialty: c.specialty,
    scope_of_work: asArray(c.scope_of_work),
    system_access: asArray(c.system_access),
    email: c.email,
    contact_person: c.contact_person,
    phone: decrypt(c.phone_enc),
    start_date: c.start_date,
    status: c.status,
    onboarding_status: c.onboarding_status,
    notes: c.notes,
    user_count: c.user_count != null ? Number(c.user_count) : undefined,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}

/** Dates and JSON have to cross the server/client boundary as plain values. */
export function serializeClient(c) {
  return {
    ...c,
    start_date: toIso(c.start_date),
    created_at: toIso(c.created_at),
    updated_at: toIso(c.updated_at),
  };
}

function toIso(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// JSON columns arrive already parsed on some mysql2/MySQL combinations and as
// strings on others.
function asArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v !== "string" || !v) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
