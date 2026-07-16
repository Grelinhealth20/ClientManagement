// Canonical list of client-dashboard sections that access can be granted to.
// Keep in sync with the client dashboard nav.
export const SECTIONS = [
  { key: "dashboard", label: "Dashboard", description: "Overview workspace" },
  { key: "onboarding", label: "Onboarding Panel", description: "Client onboarding workflow" },
];

export const SECTION_KEYS = SECTIONS.map((s) => s.key);

export function sanitizePermissions(input) {
  if (!Array.isArray(input)) return [];
  return SECTION_KEYS.filter((k) => input.includes(k));
}

export function hasSection(permissions, key) {
  if (!Array.isArray(permissions)) return false;
  return permissions.includes(key);
}
