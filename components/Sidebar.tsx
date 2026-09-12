"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Package,
  BarChart3,
  FileText,
  MessageCircle,
  Settings,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
  ShieldCheck,
  UserX,
  Boxes,
  PhoneCall,
  Inbox,
  UserCheck,
  Layers,
  MapPin,
  ChevronDown,
} from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import { useSidebarCollapse } from "@/components/SidebarContext";
import { tierAtLeast, type PlanTier } from "@/lib/entitlements";
import type { Session, UserRole } from "@/types";

interface LeafNavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  soon?: boolean;
  roles?: UserRole[]; // omit = visible to everyone
  minTier?: PlanTier; // omit = visible on every tier
}

// A non-clickable header (icon + label, no href) whose children render
// indented beneath it — "No Shows" and "Follow-Ups" are two distinct pages
// (each keeps its own route, data, and tour target), just grouped under
// one heading rather than two peer-level sidebar rows.
interface GroupNavItem {
  label: string;
  icon: typeof LayoutDashboard;
  children: LeafNavItem[];
}

type NavItem = LeafNavItem | GroupNavItem;

function isGroup(item: NavItem): item is GroupNavItem {
  return "children" in item;
}

const NAV_ITEMS: NavItem[] = [
  // "Today" (not "Overview" / "Dashboard") on purpose — this is meant to be
  // the one page someone opens each morning and gets everything about their
  // day from, so the label should say what it's for, not just where it is.
  { label: "Today", href: "/dashboard", icon: LayoutDashboard },
  { label: "Schedule", href: "/dashboard/appointments", icon: Calendar },
  // Standalone, not grouped — in practice almost nobody navigates here
  // directly. A patient's own page is reached from Schedule (a booking or
  // walk-in gets routed there via buttons), so it doesn't need to sit
  // inside a group the way the genuinely page-hopping sections below do.
  { label: "Patients", href: "/dashboard/patients", icon: Users },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
    roles: ["owner", "doctor"],
    minTier: "basic",
  },
  {
    label: "Patient Retention",
    icon: UserCheck,
    children: [
      { label: "No Shows", href: "/dashboard/no-shows", icon: UserX, minTier: "standard" },
      { label: "Follow-Ups", href: "/dashboard/follow-ups", icon: PhoneCall, minTier: "standard" },
    ],
  },
  // Clinic-defined customization for how patients are handled — presets
  // and records staff set up once and rarely revisit, unlike the daily
  // per-patient flow above. Not "Clinic Resources" (that name didn't
  // survive contact with Inventory, which is its own domain — physical
  // stock, not a patient-management preset — so it stands alone below).
  {
    label: "Patient Management",
    icon: Layers,
    children: [
      { label: "Packages", href: "/dashboard/packages", icon: Package },
      { label: "Areas", href: "/dashboard/areas", icon: MapPin },
      { label: "Documents", href: "/dashboard/documents", icon: FileText },
    ],
  },
  { label: "Inventory", href: "/dashboard/inventory", icon: Boxes, minTier: "basic" },
  {
    label: "Communication",
    icon: MessageCircle,
    children: [
      // Labeled "WhatsApp" here (not "Communication", matching the page's
      // own <h1>) — a group and its own child both saying "Communication"
      // would read as a mistake, not a hierarchy. The page itself is
      // WhatsApp connection + message templates + automation, so this is
      // more specific anyway, not just a disambiguation hack.
      { label: "WhatsApp", href: "/dashboard/communication", icon: MessageCircle, minTier: "basic" },
      { label: "Inbox", href: "/dashboard/inbox", icon: Inbox, minTier: "pro" },
    ],
  },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

// Which of the collapsible groups above the user has manually closed —
// persisted so the choice survives a reload. Group open/closed is keyed by
// label rather than index since NAV_ITEMS order is safe to change later
// without silently reinterpreting someone's stored preference as a
// different group. Starts empty (everything open) on both server and first
// client render to match; the real value is read from localStorage in an
// effect, same hydration-safe pattern as SidebarContext's collapsed state.
const GROUP_STORAGE_KEY = "sidebar-collapsed-groups";

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
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(GROUP_STORAGE_KEY);
      if (stored) setClosedGroups(new Set(JSON.parse(stored)));
    } catch {
      // Malformed/inaccessible storage — just start with everything open.
    }
  }, []);

  function toggleGroup(label: string) {
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  // Close the mobile drawer automatically on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function renderLeaf(item: LeafNavItem, showLabels: boolean, iconSize = 18) {
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
            <Icon size={iconSize} className="flex-shrink-0" />
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
        // Targeted by the guided tour (components/onboarding/
        // ProductTour.tsx) to spotlight this item. The tour forces
        // the sidebar open (SidebarContext's temporary override) for
        // the duration, so in practice this only ever needs to match
        // the desktop, labeled render — the mobile drawer copy is
        // unmounted (closed) while the tour runs.
        data-tour={`nav-${item.href}`}
        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
          showLabels ? "" : "justify-center"
        } ${isActive ? "bg-brown-700/60 text-white" : "text-beige-200 hover:bg-brown-700/60 hover:text-white"}`}
      >
        <Icon size={iconSize} className="flex-shrink-0" />
        {showLabels && <span>{item.label}</span>}
      </Link>
    );
  }

  function leafVisible(item: LeafNavItem): boolean {
    if (item.roles && !item.roles.includes(session.role)) return false;
    if (item.minTier && !tierAtLeast(tier, item.minTier)) return false;
    return true;
  }

  function NavLinks({ showLabels }: { showLabels: boolean }) {
    // Two levels: a group's own children are filtered first (role AND
    // tier), then the group itself is dropped entirely once nothing in it
    // is left visible — e.g. "Patient Retention" disappears for a Free/
    // Basic clinic, while "Communication" survives showing only "WhatsApp"
    // for a Basic clinic (Inbox stays hidden until Pro).
    const visibleItems = NAV_ITEMS.map((item) =>
      isGroup(item) ? { ...item, children: item.children.filter(leafVisible) } : item
    ).filter((item) => (isGroup(item) ? item.children.length > 0 : leafVisible(item)));
    return (
      <nav className="flex-1 space-y-0.5 px-3">
        {visibleItems.map((item) => {
          if (isGroup(item)) {
            const GroupIcon = item.icon;
            // A group containing the active page always renders open,
            // regardless of the stored preference — collapsing away the
            // page you're actually on would be confusing, not tidy.
            const containsActive = item.children.some((child) => child.href === pathname);
            const open = containsActive || !closedGroups.has(item.label);
            return (
              <div key={item.label}>
                {/* Collapsed (icon-rail) mode skips the header entirely —
                    it has no href of its own, so there's nothing useful an
                    icon-only row could do there; just the children's own
                    icons show, same as before this was grouped. Since
                    there's no header to click there, groups always render
                    fully open in icon-rail mode. */}
                {showLabels && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.label)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 rounded-md px-3 pt-3 pb-1 text-sm text-beige-200/70 transition-colors hover:text-beige-200"
                  >
                    <GroupIcon size={18} className="flex-shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      size={14}
                      className={`flex-shrink-0 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
                    />
                  </button>
                )}
                <div
                  className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
                    showLabels && !open ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
                  }`}
                >
                  <div
                    className={`overflow-hidden ${
                      showLabels ? "ml-4 space-y-0.5 border-l border-brown-700/60 pl-2" : "space-y-0.5"
                    }`}
                  >
                    {item.children.map((child) => renderLeaf(child, showLabels, 16))}
                  </div>
                </div>
              </div>
            );
          }
          return renderLeaf(item, showLabels);
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
          <span className="font-display text-lg font-medium text-brown-900">{clinicName}</span>
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
                  <div className="font-display text-xl font-medium text-white">{clinicName}</div>
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
            <NavLinks showLabels={true} />
            {session.isSuperAdmin && (
              <div className="px-3 pb-2">
                <Link
                  href="/admin"
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-beige-200 transition-colors hover:bg-brown-700/60 hover:text-white"
                >
                  <ShieldCheck size={18} className="flex-shrink-0" />
                  <span>Admin Panel</span>
                </Link>
              </div>
            )}
            <div className="border-t border-brown-700/60 px-6 py-4">
              <div className="truncate text-sm text-beige-200">{session.email}</div>
              <div className="mb-3 text-xs uppercase tracking-wide text-brown-400">{session.role}</div>
              <LogoutButton />
            </div>
          </aside>
        </div>

      {/* Desktop sidebar — hidden below md, collapsible between full/icon-rail */}
      <aside
        className="hidden h-full flex-shrink-0 flex-col overflow-y-auto bg-brown-900 text-beige-200 md:flex"
        style={{ width: collapsed ? 64 : 240, transition: "width 300ms ease-in-out" }}
      >
        <div className={`flex items-center pt-7 pb-6 ${collapsed ? "justify-center px-2" : "gap-3 px-6"}`}>
          {collapsed ? (
            <Image src="/logo.png" alt="" width={32} height={32} />
          ) : (
            <>
              <Image src="/logo.png" alt="" width={40} height={40} className="flex-shrink-0" />
              <div>
                <div className="font-display text-xl font-medium text-white">{clinicName}</div>
                <div className="mt-2 h-[2px] w-8 bg-gold-500" />
              </div>
            </>
          )}
        </div>

        <NavLinks showLabels={!collapsed} />

        {session.isSuperAdmin && (
          <div className="px-3 pb-2">
            <Link
              href="/admin"
              title={collapsed ? "Admin Panel" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-beige-200 transition-colors hover:bg-brown-700/60 hover:text-white ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <ShieldCheck size={18} className="flex-shrink-0" />
              {!collapsed && <span>Admin Panel</span>}
            </Link>
          </div>
        )}

        <div className="px-3 pb-2">
          <button
            onClick={toggleUserPreference}
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
