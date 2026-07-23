import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** A slim row of shortcuts sitting alongside the greeting, not a competing
 * block of its own — these are meant to feel like part of the page header
 * (a couple of things you might do before you even start reading today's
 * list), not another section to scan. */
export default function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href + action.label}
            href={action.href}
            className="flex items-center gap-1.5 rounded-full border border-beige-300 bg-surface px-3.5 py-2 text-xs font-medium text-brown-700 transition-colors hover:border-gold-500 hover:text-gold-600"
          >
            <Icon size={14} />
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}
