import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import type { Session } from "@/types";

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard" },
  { label: "Patients", href: "/dashboard/patients" },
  { label: "Appointments", href: "/dashboard/appointments", soon: true },
  { label: "Packages", href: "/dashboard/packages", soon: true },
  { label: "Consent Forms", href: "/dashboard/forms", soon: true },
];

export default function Sidebar({ clinicName, session }: { clinicName: string; session: Session }) {
  return (
    <aside className="flex h-screen w-60 flex-shrink-0 flex-col bg-brown-900 text-beige-200">
      <div className="px-6 pt-7 pb-6">
        <div className="font-display text-xl font-medium text-white">{clinicName}</div>
        <div className="mt-2 h-[2px] w-8 bg-gold-500" />
      </div>

      <nav className="flex-1 px-3">
        {NAV_ITEMS.map((item) =>
          item.soon ? (
            <div
              key={item.href}
              className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm text-brown-400"
            >
              <span>{item.label}</span>
              <span className="rounded-full bg-brown-700/50 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                Soon
              </span>
            </div>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2.5 text-sm text-beige-200 transition-colors hover:bg-brown-700/60 hover:text-white"
            >
              {item.label}
            </Link>
          )
        )}
      </nav>

      <div className="border-t border-brown-700/60 px-6 py-4">
        <div className="truncate text-sm text-beige-200">{session.email}</div>
        <div className="mb-3 text-xs uppercase tracking-wide text-brown-400">{session.role}</div>
        <LogoutButton />
      </div>
    </aside>
  );
}
