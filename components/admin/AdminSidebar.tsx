"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, IndianRupee, BarChart3, BookOpen, Mail, History, Menu, X } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

const NAV_ITEMS = [
  { label: "Clinics", href: "/admin", icon: Building2 },
  { label: "Pricing", href: "/admin/pricing", icon: IndianRupee },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Ledger", href: "/admin/ledger", icon: BookOpen },
  { label: "Audit Log", href: "/admin/audit-log", icon: History },
  { label: "Email", href: "/admin/email", icon: Mail },
];

/** The super-admin counterpart to components/Sidebar.tsx — same light
 * rust-on-cream visual language and the same responsive shape: a
 * persistent sidebar at md+ widths, a top bar with an off-canvas drawer
 * below it. No collapse toggle, unlike the clinic dashboard's sidebar —
 * this is a small, single-operator surface with only six destinations,
 * not something that benefits from an icon-only rail. */
export default function AdminSidebar({ adminEmail, hasClinicSession }: { adminEmail: string; hasClinicSession: boolean }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function NavLinks() {
    return (
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-rust-100 text-rust-700"
                  : "text-brown-600 hover:bg-beige-200 hover:text-brown-900"
              }`}
            >
              <Icon size={18} className={`flex-shrink-0 ${isActive ? "" : "opacity-70"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <>
      {/* Mobile top bar — only visible below md, triggers the drawer */}
      <div className="flex items-center justify-between border-b border-beige-300 bg-surface px-4 py-3 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-1.5 text-brown-700 hover:bg-beige-200"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-md" />
          <span className="font-display text-lg font-extrabold tracking-tight text-brown-900">Lumière by Radiance</span>
        </div>
        <div className="w-[34px]" /> {/* balances the hamburger button for centering */}
      </div>

      {/* Mobile drawer + backdrop — always mounted (rather than conditionally
          rendered) so both open AND close animate; a closed drawer is fully
          inert via pointer-events-none rather than being removed from the DOM. */}
      <div
        className={`fixed inset-0 z-50 md:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-brown-900/40 transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={`relative flex h-full w-72 flex-col overflow-y-auto bg-surface text-brown-900 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-5 pt-6 pb-5">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="" width={32} height={32} className="flex-shrink-0 rounded-lg" />
              <span className="font-display text-lg font-extrabold tracking-tight text-brown-900">Lumière by Radiance</span>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="rounded-md p-1 text-brown-500 hover:bg-beige-200 hover:text-brown-900"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
          <NavLinks />
          {hasClinicSession && (
            <div className="px-3 pb-2">
              <Link
                href="/dashboard"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-brown-600 transition-colors hover:bg-beige-200 hover:text-brown-900"
              >
                My Clinic Dashboard
              </Link>
            </div>
          )}
          <div className="border-t border-beige-300 px-5 py-4">
            <div className="truncate text-xs font-bold text-brown-900">{adminEmail}</div>
            <div className="mb-3 text-[10.5px] uppercase tracking-wide text-brown-400">Super Admin</div>
            <LogoutButton />
          </div>
        </aside>
      </div>

      {/* Desktop sidebar — hidden below md */}
      <aside className="hidden h-screen w-60 flex-shrink-0 flex-col overflow-y-auto border-r border-beige-300 bg-surface md:flex">
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
          <Image src="/logo.png" alt="" width={28} height={28} className="flex-shrink-0 rounded-lg" />
          <span className="font-display text-base font-extrabold tracking-tight text-brown-900">Lumière by Radiance</span>
        </div>

        <NavLinks />

        {hasClinicSession && (
          <div className="px-3 pb-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-brown-600 transition-colors hover:bg-beige-200 hover:text-brown-900"
            >
              My Clinic Dashboard
            </Link>
          </div>
        )}

        <div className="border-t border-beige-300 px-5 py-4">
          <div className="truncate text-xs font-bold text-brown-900">{adminEmail}</div>
          <div className="mb-3 text-[10.5px] uppercase tracking-wide text-brown-400">Super Admin</div>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
