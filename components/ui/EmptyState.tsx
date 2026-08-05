import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/** Shared "nothing here yet" card — an icon badge, a message, and an
 * optional way forward. Used anywhere a list can legitimately be empty
 * (brand-new clinic, first patient, no results yet) so those moments read
 * as an intentional, designed state rather than a blank box, consistently
 * across the app. `compact` trims the padding for panels nested inside an
 * already-boxed section (e.g. the dashboard overview) rather than a
 * full-width page section. */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-xl bg-surface text-center shadow-soft ring-1 ring-beige-300 ${
        compact ? "p-6" : "p-10"
      }`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-100">
        <Icon className="text-gold-600" size={20} />
      </div>
      <p className="mt-3 text-sm font-medium text-brown-700">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-brown-400">{description}</p>}
      {action && (
        <Link href={action.href} className="mt-3 text-sm font-medium text-gold-600 hover:underline">
          {action.label}
        </Link>
      )}
    </div>
  );
}
