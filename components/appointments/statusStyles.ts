import type { AppointmentStatus } from "@/types";

export const STATUS_STYLES: Record<AppointmentStatus, { bg: string; text: string; dot: string }> = {
  booked: { bg: "bg-gold-100", text: "text-gold-600", dot: "bg-gold-500" },
  completed: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-600" },
  cancelled: { bg: "bg-beige-300", text: "text-brown-500", dot: "bg-brown-400" },
  "no-show": { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
  "no-show": "No-Show",
};
