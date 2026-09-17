import type { SessionColumnDef, SessionTypeDef } from "@/types";

export interface SessionTypeConfig {
  label: string;
  badgeText: string;
  badgeClassName: string; // Tailwind classes for the badge chip
  chartColor: string; // hex color, used in revenue-by-type charts (PieChart, RevenueChart)
  columns: SessionColumnDef[];
  custom?: boolean; // true for clinic-defined machine types (vs. built-in LHR)
  // True for a type that resolves (badges/labels render correctly
  // wherever it's already used) but is never offered as a choice — not in
  // the Treatment/session-type pickers, Settings → Machine Types, or a
  // patient's Visit tabs. See pickableSessionTypeEntries() below.
  hiddenByDefault?: boolean;
}

// The one treatment type every clinic starts with. Clinics can add their
// own major machine types (e.g. "CO2 Laser") from Settings — see
// SessionTypeDef in types/index.ts and buildSessionTypeConfig() below,
// which merges those in alongside this built-in. Q-Switch used to be a
// second built-in here too; it isn't a pre-defined default anymore — a
// clinic that wants it now adds it themselves as a custom machine type,
// same as any other.
export const BUILT_IN_SESSION_TYPE_CONFIG: Record<string, SessionTypeConfig> = {
  lhr: {
    label: "Laser Hair Removal",
    badgeText: "LHR",
    badgeClassName: "bg-gold-600 text-white",
    chartColor: "#A9812F",
    columns: [
      {
        key: "area",
        label: "Area",
        type: "select",
        options: [
          "Upper Lip",
          "Chin",
          "Full Face",
          "Underarms",
          "Half Arms",
          "Full Arms",
          "Half Legs",
          "Full Legs",
          "Bikini Line",
          "Back",
          "Chest",
          "Full Body",
        ],
      },
      { key: "hr", label: "HR", type: "number" },
      { key: "shr", label: "SHR", type: "number" },
      { key: "stack", label: "Stack", type: "number" },
      { key: "fee", label: "Fee", type: "number" },
    ],
  },
};

// Not a "built-in default" — never merged into a picker (Treatment select,
// Machine session-type select, Settings → Machine Types, a patient's Visit
// tabs) — but still resolvable by exact key, since the public booking page
// (app/book/[slug]) always creates appointments with this sessionType
// (a new visitor doesn't know which treatment they need yet, so that page
// never offers a treatment picker at all — it always books this) and needs
// its badge to render correctly wherever those appointments show up. No
// machine-data columns, since a consultation is a doctor assessment, not a
// treatment session.
const CONSULTATION_SESSION_TYPE_CONFIG: SessionTypeConfig = {
  label: "Consultation",
  badgeText: "CONSULT",
  badgeClassName: "bg-beige-300 text-brown-800",
  chartColor: "#8C7B6B",
  columns: [],
  hiddenByDefault: true,
};

// Same reasoning as CONSULTATION_SESSION_TYPE_CONFIG above: Q-Switch used
// to be a built-in default (see BUILT_IN_SESSION_TYPE_CONFIG's own
// comment), so a clinic that was already live before that change can have
// real appointments/visits/packages with sessionType "qs" that predate
// it. Without an entry here, SESSION_TYPE_CONFIG["qs"] is undefined for
// any such clinic that never re-added it as its own custom machine type,
// and every call site that reads `.badgeText`/`.label`/etc. off that
// lookup throws — this restores exact resolution (same label, badge,
// columns as the old built-in) without reintroducing it as a pickable
// default for new clinics.
const QS_SESSION_TYPE_CONFIG: SessionTypeConfig = {
  label: "Q-Switch",
  badgeText: "QS",
  badgeClassName: "bg-brown-900 text-beige-200",
  chartColor: "#2C1D14",
  columns: [
    {
      key: "area",
      label: "Area",
      type: "select",
      options: ["Full Face", "Cheeks", "Underarms", "Neck", "Hands", "Back", "Chest", "Tattoo Removal", "Full Body"],
    },
    { key: "carbon", label: "Carbon", type: "select", options: ["Yes", "No"] },
    { key: "mode", label: "Mode", type: "text" },
    { key: "hp", label: "HP", type: "text" },
    { key: "eng", label: "Eng", type: "number" },
    { key: "pass", label: "Pass", type: "number" },
    { key: "repeat", label: "Repeat", type: "number" },
    { key: "fee", label: "Fee", type: "number" },
  ],
  hiddenByDefault: true,
};

/** Back-compat alias — built-ins only, no clinic-defined custom types.
 * Prefer buildSessionTypeConfig() (server) or useSessionTypeConfig() (client,
 * via lib/sessionTypeConfigContext.tsx) wherever a clinic's custom machine
 * types should also be reflected. */
export const SESSION_TYPE_CONFIG = BUILT_IN_SESSION_TYPE_CONFIG;

export function sessionTypeDefToConfig(def: SessionTypeDef): SessionTypeConfig {
  return {
    label: def.label,
    badgeText: def.badgeText,
    badgeClassName: def.badgeClassName,
    chartColor: def.chartColor,
    columns: def.columns,
    custom: true,
  };
}

/** Merges the built-in LHR config, the always-resolvable-but-hidden
 * consultation and Q-Switch configs, and a clinic's own custom machine
 * types (see lib/db/sessionTypeDefs.ts) into the single lookup table used
 * everywhere a SessionType needs to be rendered or have its data-entry
 * columns resolved. A clinic that's since added its own real "qs" custom
 * machine type overrides this fallback below, same as any other key. */
export function buildSessionTypeConfig(
  customTypes: SessionTypeDef[] = []
): Record<string, SessionTypeConfig> {
  const merged: Record<string, SessionTypeConfig> = {
    ...BUILT_IN_SESSION_TYPE_CONFIG,
    consultation: CONSULTATION_SESSION_TYPE_CONFIG,
    qs: QS_SESSION_TYPE_CONFIG,
  };
  for (const def of customTypes) {
    merged[def.key] = sessionTypeDefToConfig(def);
  }
  return merged;
}

/** The subset of a merged config that should actually be offered as a
 * choice — everywhere except `hiddenByDefault` entries (currently just
 * "consultation", see its own comment above). Use this instead of
 * `Object.keys(config)`/`Object.entries(config)` wherever the UI is
 * letting someone pick a session type, not just rendering one that's
 * already set. */
export function pickableSessionTypeEntries(
  config: Record<string, SessionTypeConfig>
): [string, SessionTypeConfig][] {
  return Object.entries(config).filter(([, cfg]) => !cfg.hiddenByDefault);
}

export function numericFieldKeysFor(config: Record<string, SessionTypeConfig>): Set<string> {
  return new Set(
    Object.values(config)
      .flatMap((cfg) => cfg.columns)
      .filter((col) => col.type === "number")
      .map((col) => col.key)
  );
}

/** Back-compat alias — built-ins only. Prefer numericFieldKeysFor(config)
 * with the merged config wherever custom types are in play. */
export const NUMERIC_FIELD_KEYS = numericFieldKeysFor(BUILT_IN_SESSION_TYPE_CONFIG);

const SLUG_CHARS = /[^a-z0-9]+/g;

/** Turns a machine type label like "CO2 Laser" into a Firestore/URL-safe key
 * like "co2_laser", deduped against `taken` (existing built-in + custom keys)
 * by appending a numeric suffix if needed. */
export function slugifySessionTypeKey(label: string, taken: Set<string>): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(SLUG_CHARS, "_")
    .replace(/^_+|_+$/g, "") || "machine_type";
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}
