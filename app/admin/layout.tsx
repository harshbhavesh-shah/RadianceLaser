import { redirect } from "next/navigation";
import { getAdminSession, getSession } from "@/lib/session";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The REAL auth check for everything under /admin — middleware.ts only
  // confirms a session cookie exists at all, not that it carries the
  // superAdmin claim. Every server action under app/admin also re-checks
  // this independently (see app/admin/actions.ts requireSuperAdmin()),
  // since actions can be invoked directly, not just reached by navigating
  // through this layout.
  const adminSession = await getAdminSession();
  if (!adminSession) redirect("/login");

  // If this same account also happens to run a clinic (dual-purpose
  // account — see types/index.ts Session.isSuperAdmin), offer a way back to
  // it. Most super-admin accounts won't have this.
  const clinicSession = await getSession();

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <AdminSidebar adminEmail={adminSession.email || ""} hasClinicSession={!!clinicSession} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-10">{children}</main>
    </div>
  );
}
