import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession, getSession } from "@/lib/session";
import LogoutButton from "@/components/LogoutButton";

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
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between border-b border-beige-300 bg-brown-900 px-6 py-4 text-beige-200">
        <div>
          <div className="font-display text-lg font-medium text-white">RadianceLaser — Admin</div>
          <div className="mt-1 h-[2px] w-6 bg-gold-500" />
        </div>
        <div className="flex items-center gap-4 text-sm">
          {clinicSession && (
            <Link href="/dashboard" className="text-beige-200 hover:text-white hover:underline">
              My Clinic Dashboard
            </Link>
          )}
          <span className="text-brown-400">{adminSession.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 p-6 md:p-10">{children}</main>
    </div>
  );
}
