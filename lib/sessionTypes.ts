import type { SessionColumnDef, SessionTypeDef } from "@/types";

export interface SessionTypeConfig {
  label: string;
  badgeText: string;
  badgeClassName: string; // Tailwind classes for the badge chip
  chartColor: string; // hex color, used in revenue-by-type charts (PieChart, RevenueChart)
  columns: SessionColumnDef[];
  custom?: boolean; // true for clinic-defined machine types (vs. built-in QS/LHR)
}

// The two treatment types every clinic starts with. Clinics can add their
// own major machine types (e.g. "CO2 Laser") from Settings — see
// SessionTypeDef in types/index.ts and buildSessionTypeConfig() below,
// which merges those in alongside these built-ins.
export const BUILT_IN_SESSION_TYPE_CONFIG: Record<string, SessionTypeConfig> = {
  qs: {
    label: "Q-Switch",
    badgeText: "QS",
    badgeClassName: "bg-brown-900 text-beige-200",
    chartColor: "#2C1D14",
    columns: [
      { key: "area", label: "Area", type: "text" },
      { key: "carbon", label: "Carbon", type: "select", options: ["Yes", "No"] },
      { key: "mode", label: "Mode", type: "text" },
      { key: "hp", label: "HP", type: "text" },
      { key: "eng", label: "Eng", type: "number" },
      { key: "pass", label: "Pass", type: "number" },
      { key: "repeat", label: "Repeat", type: "number" },
      { key: "fee", label: "Fee", type: "number" },
    ],
  },
  lhr: {
    label: "Laser Hair Removal",
    badgeText: "LHR",
    badgeClassName: "bg-gold-600 text-white",
    chartColor: "#A9812F",
    columns: [
      { key: "area", label: "Area", type: "text" },
      { key: "hr", label: "HR", type: "number" },
      { key: "shr", label: "SHR", type: "number" },
      { key: "stack", label: "Stack", type: "number" },
      { key: "fee", label: "Fee", type: "number" },
    ],
  },
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

/** Merges the built-in Q-Switch/LHR config with a clinic's own custom
 * machine types (fetched from Firestore — see lib/firestore/sessionTypeDefs.ts)
 * into the single lookup table used everywhere a SessionType needs to be
 * rendered or have its data-entry columns resolved. */
export function buildSessionTypeConfig(
  customTypes: SessionTypeDef[] = []
): Record<string, SessionTypeConfig> {
  const merged: Record<string, SessionTypeConfig> = { ...BUILT_IN_SESSION_TYPE_CONFIG };
  for (const def of customTypes) {
    merged[def.key] = sessionTypeDefToConfig(def);
  }
  return merged;
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
