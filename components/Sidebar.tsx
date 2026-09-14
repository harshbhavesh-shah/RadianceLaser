"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  BarChart3,
  MessageCircle,
  Settings,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
  ShieldCheck,
  Boxes,
  UserCheck,
  Layers,
} from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import { useSidebarCollapse } from "@/components/SidebarContext";
import { tierAtLeast, type PlanTier } from "@/lib/entitlements";
import type { Session, UserRole } from "@/types";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  soon?: boolean;
  roles?: UserRole[]; // omit = visible to everyone
  minTier?: PlanTier; // omit = visible on every tier
}

// Every former group (Patient Retention, Patient Management, Communication)
// is now a single page with its own internal tab bar — see
// components/patients-config/PatientRetentionTabs.tsx,
// components/patients-config/PatientManagementTabs.tsx, and
// components/communication/CommunicationTabs.tsx — rather than a sidebar
// group whose children were really just that page's own sections one level
// too high. One flat list, no nesting, matching how Patients/Documents
// were already structured before this.
const NAV_ITEMS: NavItem[] = [
  // "Today" (not "Overview" / "Dashboard") on purpose — this is meant to be
  // the one page someone opens each morning and gets everything about their
  // day from, so the label should say what it's for, not just where it is.
  { label: "Today", href: "/dashboard", icon: LayoutDashboard },
  { label: "Schedule", href: "/dashboard/appointments", icon: Calendar },
  { label: "Patients", href: "/dashboard/patients", icon: Users },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
    roles: ["owner", "doctor"],
    minTier: "basic",
  },
  // No Shows / Follow-Ups tabs live here now — see PatientRetentionTabs.
  { label: "Patient Retention", href: "/dashboard/no-shows", icon: UserCheck, minTier: "standard" },
  // Packages / Areas / Consent Forms / Receipts tabs live here now — see
  // PatientManagementTabs.
  { label: "Patient Management", href: "/dashboard/packages", icon: Layers },
  { label: "Inventory", href: "/dashboard/inventory", icon: Boxes, minTier: "basic" },
  // WhatsApp / Inbox tabs live here now — see CommunicationTabs.
  { label: "Communication", href: "/dashboard/communication", icon: MessageCircle, minTier: "basic" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

function initialsOf(email: string | null): string {
  if (!email) return "?";
  const local = email.split("@")[0] || email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  const chars = parts.length >= 2 ? [parts[0][0], parts[1][0]] : [local[0], local[1] ?? ""];
  return chars.join("").toUpperCase();
}

export default function Sidebar({
  clinicName,
  session,
  tier,
}: {
  clinicName: string;
  session: Session;
  tier: PlanTier;
}) {
  const pathname = usePathname();
  const { collapsed, toggleUserPreference } = useSidebarCollapse();
  const [mobileOpen, setMobileOpen] = useState(false); // mobile off-canvas drawer

  // Close the mobile drawer automatically on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function renderLeaf(item: NavItem, showLabels: boolean) {
    const Icon = item.icon;
    const isActive = pathname === item.href;

    if (item.soon) {
      return (
        <div
          key={item.href}
          title={showLabels ? undefined : `${item.label} (Soon)`}
          className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-brown-400 ${
            showLabels ? "justify-between" : "justify-center"
          }`}
        >
          <span className="flex items-center gap-3">
            <Icon size={18} className="flex-shrink-0" />
            {showLabels && <span>{item.label}</span>}
          </span>
          {showLabels && (
            <span className="rounded-full bg-beige-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brown-500">
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
        // Targeted by the guided tour (components/onboarding/
        // ProductTour.tsx) to spotlight this item. The tour forces
        // the sidebar open (SidebarContext's temporary override) for
        // the duration, so in practice this only ever needs to match
        // the desktop, labeled render — the mobile drawer copy is
        // unmounted (closed) while the tour runs.
        data-tour={`nav-${item.href}`}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
          showLabels ? "" : "justify-center"
        } ${
          isActive
            ? "bg-rust-100 text-rust-700"
            : "text-brown-600 hover:bg-beige-200 hover:text-brown-900"
        }`}
      >
        <Icon size={18} className={`flex-shrink-0 ${isActive ? "" : "opacity-70"}`} />
        {showLabels && <span>{item.label}</span>}
      </Link>
    );
  }

  function leafVisible(item: NavItem): boolean {
    if (item.roles && !item.roles.includes(session.role)) return false;
    if (item.minTier && !tierAtLeast(tier, item.minTier)) return false;
    return true;
  }

  function NavLinks({ showLabels }: { showLabels: boolean }) {
    const visibleItems = NAV_ITEMS.filter(leafVisible);
    return (
      <nav className="flex-1 space-y-0.5 px-3">
        {visibleItems.map((item) => renderLeaf(item, showLabels))}
      </nav>
    );
  }

  function SidebarFoot({ showLabels }: { showLabels: boolean }) {
    return (
      <div className={`border-t border-beige-300 py-4 ${showLabels ? "px-4" : "px-2"}`}>
        <div className={`flex items-center gap-2.5 ${showLabels ? "" : "justify-center"}`}>
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-rust-100 text-[11px] font-bold text-rust-700">
            {initialsOf(session.email)}
          </div>
          {showLabels && (
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-brown-900">{session.email}</div>
              <div className="text-[10.5px] uppercase tracking-wide text-brown-400">{session.role}</div>
            </div>
          )}
        </div>
        <div className={`mt-3 ${showLabels ? "" : "flex justify-center"}`}>
          <LogoutButton />
        </div>
      </div>
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
          <span className="font-display text-lg font-extrabold tracking-tight text-brown-900">{clinicName}</span>
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
              <span className="font-display text-lg font-extrabold tracking-tight text-brown-900">{clinicName}</span>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="rounded-md p-1 text-brown-500 hover:bg-beige-200 hover:text-brown-900"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
          <NavLinks showLabels={true} />
          {session.isSuperAdmin && (
            <div className="px-3 pb-2">
              <Link
                href="/admin"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-brown-600 transition-colors hover:bg-beige-200 hover:text-brown-900"
              >
                <ShieldCheck size={18} className="flex-shrink-0 opacity-70" />
                <span>Admin Panel</span>
              </Link>
            </div>
          )}
          <SidebarFoot showLabels={true} />
        </aside>
      </div>

      {/* Desktop sidebar — hidden below md, collapsible between full/icon-rail */}
      <aside
        className="hidden h-full flex-shrink-0 flex-col overflow-y-auto border-r border-beige-300 bg-surface md:flex"
        style={{ width: collapsed ? 64 : 236, transition: "width 300ms ease-in-out" }}
      >
        <div className={`flex items-center pt-6 pb-5 ${collapsed ? "justify-center px-2" : "gap-2.5 px-5"}`}>
          <Image
            src="/logo.png"
            alt=""
            width={collapsed ? 30 : 28}
            height={collapsed ? 30 : 28}
            className="flex-shrink-0 rounded-lg"
          />
          {!collapsed && (
            <span className="font-display text-base font-extrabold tracking-tight text-brown-900">
              {clinicName}
            </span>
          )}
        </div>

        <NavLinks showLabels={!collapsed} />

        {session.isSuperAdmin && (
          <div className="px-3 pb-2">
            <Link
              href="/admin"
              title={collapsed ? "Admin Panel" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-brown-600 transition-colors hover:bg-beige-200 hover:text-brown-900 ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <ShieldCheck size={18} className="flex-shrink-0 opacity-70" />
              {!collapsed && <span>Admin Panel</span>}
            </Link>
          </div>
        )}

        <div className="px-3 pb-2">
          <button
            onClick={toggleUserPreference}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-brown-500 transition-colors hover:bg-beige-200 hover:text-brown-900 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            {collapsed ? <PanelLeft size={18} className="opacity-70" /> : <PanelLeftClose size={18} className="opacity-70" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>

        <SidebarFoot showLabels={!collapsed} />
      </aside>
    </>
  );
}
