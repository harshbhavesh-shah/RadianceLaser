import type { SessionColumnDef, SessionType } from "@/types";

export interface SessionTypeConfig {
  label: string;
  badgeText: string;
  badgeClassName: string; // Tailwind classes for the badge chip
  columns: SessionColumnDef[];
}

export const SESSION_TYPE_CONFIG: Record<SessionType, SessionTypeConfig> = {
  qs: {
    label: "Q-Switch",
    badgeText: "QS",
    badgeClassName: "bg-brown-900 text-beige-200",
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
    columns: [
      { key: "area", label: "Area", type: "text" },
      { key: "hr", label: "HR", type: "number" },
      { key: "shr", label: "SHR", type: "number" },
      { key: "stack", label: "Stack", type: "number" },
      { key: "fee", label: "Fee", type: "number" },
    ],
  },
};

export const NUMERIC_FIELD_KEYS = new Set(
  Object.values(SESSION_TYPE_CONFIG)
    .flatMap((cfg) => cfg.columns)
    .filter((col) => col.type === "number")
    .map((col) => col.key)
);
