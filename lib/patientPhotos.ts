// Shared between the upload modal (client) and anywhere else that needs to
// guess whether a photo is of a sensitive area, so the "blur by default"
// checkbox comes pre-checked instead of relying on staff to remember every
// time. It's only a suggestion — always editable before upload.

const SENSITIVE_AREA_KEYWORDS = [
  "underarm",
  "under arm",
  "bikini",
  "brazilian",
  "groin",
  "genital",
  "buttock",
  "butt",
  "breast",
  "chest", // ambiguous (also a common non-sensitive LHR area on men) but erring cautious
  "private",
  "intimate",
  "pubic",
];

export function isLikelySensitiveArea(area: string | undefined | null): boolean {
  if (!area) return false;
  const normalized = area.toLowerCase();
  return SENSITIVE_AREA_KEYWORDS.some((kw) => normalized.includes(kw));
}
