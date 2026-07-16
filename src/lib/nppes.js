// Real integration with the CMS NPPES NPI Registry (public, free, no key).
// https://npiregistry.cms.hhs.gov/api/  — we proxy it server-side so the browser
// never calls it directly (avoids CORS, lets us cache + normalize).

const NPPES_URL = "https://npiregistry.cms.hhs.gov/api/";
const TIMEOUT_MS = 8000;

// Small in-process cache so repeated lookups for the same name (a user typing,
// re-opening the step) don't hammer the registry.
const globalForNppes = globalThis;
const cache = (globalForNppes.__grelinNppesCache ??= new Map());
const CACHE_TTL_MS = 5 * 60 * 1000;

function titleCase(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .trim();
}

/** A full "street, city, ST zip" line from one NPPES address record. */
function formatAddress(a) {
  if (!a) return "";
  const street = [titleCase(a.address_1), titleCase(a.address_2)].filter(Boolean).join(", ");
  const cityState = [titleCase(a.city), (a.state || "").toUpperCase()].filter(Boolean).join(", ");
  const zip = (a.postal_code || "").slice(0, 5);
  return [street, cityState, zip].filter(Boolean).join(" ").replace(/\s+,/g, ",").trim();
}

/** Shape one NPPES result into just what the facility form needs. */
function normalize(r) {
  const addrs = Array.isArray(r.addresses) ? r.addresses : [];
  // Primary practice location vs. mailing address — kept separate so each maps
  // to its own field.
  const loc = addrs.find((a) => a.address_purpose === "LOCATION") || addrs[0] || {};
  const mail = addrs.find((a) => a.address_purpose === "MAILING") || {};
  // Every taxonomy the registry lists for this organization.
  const taxonomies = (Array.isArray(r.taxonomies) ? r.taxonomies : []).map((t) => ({
    code: t.code,
    desc: t.desc,
    primary: !!t.primary,
  }));
  const b = r.basic || {};
  // The "Doing Business As" name lives in the other_names array (type code "3"),
  // not in `basic`. Fall back to any other listed name.
  const otherNames = Array.isArray(r.other_names) ? r.other_names : [];
  const dba =
    otherNames.find((o) => o.code === "3" || /doing business/i.test(o.type || ""))?.organization_name ||
    otherNames[0]?.organization_name ||
    "";
  return {
    npi: String(r.number || ""),
    name: b.organization_name || "",
    dba,
    // Primary practice address → Facility Address; mailing address → Mailing.
    practiceAddress: formatAddress(loc),
    mailingAddress: formatAddress(mail),
    city: titleCase(loc.city),
    state: (loc.state || "").toUpperCase(),
    phone: loc.telephone_number || mail.telephone_number || b.authorized_official_telephone_number || "",
    taxonomies,
    official:
      b.authorized_official_first_name || b.authorized_official_last_name
        ? titleCase(`${b.authorized_official_first_name || ""} ${b.authorized_official_last_name || ""}`)
        : "",
  };
}

/**
 * Validate an individual (Type-1) NPI against the registry. Returns
 * { valid, name } — valid only when the number resolves to a real individual
 * provider. Never throws; returns { valid: false, error } on a registry issue.
 */
export async function validateIndividualNpi(npi) {
  const num = String(npi || "").replace(/\D/g, "");
  if (num.length !== 10) return { valid: false };
  const url = `${NPPES_URL}?version=2.1&number=${num}&enumeration_type=NPI-1`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "GrelinHealthOnboarding/1.0" } });
    if (!res.ok) return { valid: false, error: "Registry unavailable." };
    const data = await res.json();
    const rec = (data.results || [])[0];
    if (!rec || rec.enumeration_type !== "NPI-1") return { valid: false };
    const b = rec.basic || {};
    return { valid: true, name: titleCase(`${b.first_name || ""} ${b.last_name || ""}`) };
  } catch (e) {
    return { valid: false, error: e.name === "AbortError" ? "Registry timed out." : "Registry unavailable." };
  } finally {
    clearTimeout(timer);
  }
}

/** Rank so an exact name match, then a prefix match, floats to the top. */
function rank(matches, name) {
  const n = name.trim().toLowerCase();
  const score = (m) => {
    const nm = (m.name || "").toLowerCase();
    if (nm === n) return 0;
    if (nm.startsWith(n)) return 1;
    if (nm.includes(n)) return 2;
    return 3;
  };
  return [...matches].sort((a, b) => score(a) - score(b));
}

/**
 * Search organizations (Type-2 NPIs) by name. Returns { matches } (possibly
 * empty). Never throws for a registry/network failure — returns { matches: [],
 * error } so the form degrades to manual entry.
 */
export async function searchOrganizations(name) {
  const q = String(name || "").trim();
  if (q.length < 3) return { matches: [] };

  const cacheKey = q.toLowerCase();
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return { matches: hit.matches };

  const url = `${NPPES_URL}?version=2.1&organization_name=${encodeURIComponent(q)}*&enumeration_type=NPI-2&limit=10`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "GrelinHealthOnboarding/1.0" },
    });
    if (!res.ok) return { matches: [], error: "Registry unavailable." };
    const data = await res.json();
    const matches = rank((data.results || []).map(normalize).filter((m) => m.npi), q).slice(0, 8);
    cache.set(cacheKey, { matches, expires: Date.now() + CACHE_TTL_MS });
    return { matches };
  } catch (e) {
    return { matches: [], error: e.name === "AbortError" ? "Registry timed out." : "Registry unavailable." };
  } finally {
    clearTimeout(timer);
  }
}
