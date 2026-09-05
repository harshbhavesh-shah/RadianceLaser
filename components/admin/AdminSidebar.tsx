"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, IndianRupee, BarChart3, BookOpen } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

const NAV_ITEMS = [
  { label: "Clinics", href: "/admin", icon: Building2 },
  { label: "Pricing", href: "/admin/pricing", icon: IndianRupee },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Ledger", href: "/admin/ledger", icon: BookOpen },
];

/** The super-admin counterpart to components/Sidebar.tsx — same dark
 * brown/gold visual language as the clinic-facing dashboard, so /admin
 * reads as part of the same product rather than a bolted-on internal tool.
 * Simpler on purpose: no collapse toggle, no mobile drawer — this is a
 * small, single-operator surface, not something staff use day to day. */
export default function AdminSidebar({ adminEmail, hasClinicSession }: { adminEmail: string; hasClinicSession: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-shrink-0 flex-col bg-brown-900 text-beige-200">
      <div className="flex items-center gap-3 px-6 pt-7 pb-6">
        <Image src="/logo.png" alt="" width={40} height={40} className="flex-shrink-0" />
        <div>
          <div className="font-display text-lg font-medium text-white">Radiance Laser</div>
          <div className="mt-2 h-[2px] w-8 bg-gold-500" />
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                isActive ? "bg-brown-700/60 text-white" : "text-beige-200 hover:bg-brown-700/60 hover:text-white"
              }`}
            >
              <Icon size={18} className="flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {hasClinicSession && (
        <div className="px-3 pb-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-beige-200 transition-colors hover:bg-brown-700/60 hover:text-white"
          >
            My Clinic Dashboard
          </Link>
        </div>
      )}

      <div className="border-t border-brown-700/60 px-6 py-4">
        <div className="truncate text-sm text-beige-200">{adminEmail}</div>
        <div className="mb-3 text-xs uppercase tracking-wide text-brown-400">Super Admin</div>
        <LogoutButton />
      </div>
    </aside>
  );
}
