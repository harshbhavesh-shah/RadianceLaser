import { STATUS_STYLES } from "./statusStyles";

/** Schedule-page-only status colors — "booked" gets the new rust accent
 * here instead of the shared gold, everything else keeps the same
 * semantic colors from statusStyles.ts (completed/cancelled/no-show mean
 * the same thing everywhere). Scoped to app/dashboard/appointments so
 * every other page that imports statusStyles.ts directly (PackageCard,
 * MachinesSection, etc.) is untouched. */
export const SCHEDULE_STATUS_STYLE = {
  ...STATUS_STYLES,
  booked: { bg: "bg-rust-100", text: "text-rust-700", dot: "bg-rust-600" },
};
