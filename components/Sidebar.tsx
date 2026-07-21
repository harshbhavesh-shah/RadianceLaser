"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Package,
  FileText,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import type { Session } from "@/types";

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Patients", href: "/dashboard/patients", icon: Users },
  { label: "Appointments", href: "/dashboard/appointments", icon: Calendar, soon: true },
  { label: "Packages", href: "/dashboard/packages", icon: Package },
  { label: "Consent Forms", href: "/dashboard/forms", icon: FileText, soon: true },
];

const COLLAPSE_STORAGE_KEY = "sidebar-collapsed";

export default function Sidebar({ clinicName, session }: { clinicName: string; session: Session }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false); // desktop icon-rail mode
  const [mobileOpen, setMobileOpen] = useState(false); // mobile off-canvas drawer

  // Remember the desktop collapse preference across visits.
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      return next;
    });
  }

  // Close the mobile drawer automatically on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function NavLinks({ showLabels }: { showLabels: boolean }) {
    return (
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          if (item.soon) {
            return (
              <div
                key={item.href}
                title={showLabels ? undefined : `${item.label} (Soon)`}
                className={`flex items-center rounded-md px-3 py-2.5 text-sm text-brown-400 ${
                  showLabels ? "justify-between" : "justify-center"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon size={18} className="flex-shrink-0" />
                  {showLabels && <span>{item.label}</span>}
                </span>
                {showLabels && (
                  <span className="rounded-full bg-brown-700/50 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                    Soon
                  </span>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              title={showLabels ? undefined : item.label}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                showLabels ? "" : "justify-center"
              } ${
                isActive
                  ? "bg-brown-700/60 text-white"
                  : "text-beige-200 hover:bg-brown-700/60 hover:text-white"
              }`}
            >
              <Icon size={18} className="flex-shrink-0" />
              {showLabels && <span>{item.label}</span>}
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
        <div className="font-display text-lg font-medium text-brown-900">{clinicName}</div>
        <div className="w-[34px]" /> {/* balances the hamburger button for centering */}
      </div>

      {/* Mobile drawer + backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-brown-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-72 flex-col bg-brown-900 text-beige-200 shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-6">
              <div>
                <div className="font-display text-xl font-medium text-white">{clinicName}</div>
                <div className="mt-2 h-[2px] w-8 bg-gold-500" />
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1 text-beige-200 hover:text-white"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>
            <NavLinks showLabels={true} />
            <div className="border-t border-brown-700/60 px-6 py-4">
              <div className="truncate text-sm text-beige-200">{session.email}</div>
              <div className="mb-3 text-xs uppercase tracking-wide text-brown-400">{session.role}</div>
              <LogoutButton />
            </div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar — hidden below md, collapsible between full/icon-rail */}
      <aside
        className={`hidden min-h-screen flex-shrink-0 flex-col bg-brown-900 text-beige-200 transition-all duration-200 md:flex ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div className={`flex items-center pt-7 pb-6 ${collapsed ? "justify-center px-2" : "px-6"}`}>
          {collapsed ? (
            <div className="h-2.5 w-2.5 rounded-full bg-gold-500" />
          ) : (
            <div>
              <div className="font-display text-xl font-medium text-white">{clinicName}</div>
              <div className="mt-2 h-[2px] w-8 bg-gold-500" />
            </div>
          )}
        </div>

        <NavLinks showLabels={!collapsed} />

        <div className="px-3 pb-2">
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-brown-400 transition-colors hover:bg-brown-700/60 hover:text-white ${
              collapsed ? "justify-center" : ""
            }`}
          >
            {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>

        <div className={`border-t border-brown-700/60 py-4 ${collapsed ? "px-2" : "px-6"}`}>
          {!collapsed && (
            <>
              <div className="truncate text-sm text-beige-200">{session.email}</div>
              <div className="mb-3 text-xs uppercase tracking-wide text-brown-400">{session.role}</div>
            </>
          )}
          <div className={collapsed ? "flex justify-center" : ""}>
            <LogoutButton />
          </div>
        </div>
      </aside>
    </>
  );
}
