"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, IndianRupee, BarChart3, BookOpen, Mail, Menu, X } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

const NAV_ITEMS = [
  { label: "Clinics", href: "/admin", icon: Building2 },
  { label: "Pricing", href: "/admin/pricing", icon: IndianRupee },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Ledger", href: "/admin/ledger", icon: BookOpen },
  { label: "Email", href: "/admin/email", icon: Mail },
];

/** The super-admin counterpart to components/Sidebar.tsx — same dark
 * brown/gold visual language, and the same responsive shape: a persistent
 * sidebar at md+ widths, a top bar with an off-canvas drawer below it. No
 * collapse toggle, unlike the clinic dashboard's sidebar — this is a small,
 * single-operator surface with only five destinations, not something that
 * benefits from an icon-only rail. */
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
          <Image src="/logo.png" alt="" width={28} height={28} />
          <span className="font-display text-lg font-medium text-brown-900">Radiance Laser</span>
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
          className={`absolute inset-0 bg-brown-900/50 transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={`relative flex h-full w-72 flex-col bg-brown-900 text-beige-200 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
            <div className="flex items-center justify-between px-6 pt-6 pb-6">
              <div className="flex items-center gap-3">
                <Image src="/logo.png" alt="" width={36} height={36} />
                <div>
                  <div className="font-display text-xl font-medium text-white">Radiance Laser</div>
                  <div className="mt-2 h-[2px] w-8 bg-gold-500" />
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1 text-beige-200 hover:text-white"
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
        </div>

      {/* Desktop sidebar — hidden below md */}
      <aside className="hidden h-screen w-60 flex-shrink-0 flex-col bg-brown-900 text-beige-200 md:flex">
        <div className="flex items-center gap-3 px-6 pt-7 pb-6">
          <Image src="/logo.png" alt="" width={40} height={40} className="flex-shrink-0" />
          <div>
            <div className="font-display text-lg font-medium text-white">Radiance Laser</div>
            <div className="mt-2 h-[2px] w-8 bg-gold-500" />
          </div>
        </div>

        <NavLinks />

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
    </>
  );
}
