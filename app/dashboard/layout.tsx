import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinic } from "@/lib/db/clinics";
import { getClinicSessionTypeDefs } from "@/lib/db/sessionTypeDefs";
import { getClinicAreaDefs } from "@/lib/db/areaDefs";
import { buildSessionTypeConfig } from "@/lib/sessionTypes";
import { getClinicAccess } from "@/lib/subscription";
import { SessionTypeConfigProvider } from "@/lib/sessionTypeConfigContext";
import { AreaDefsProvider } from "@/lib/areaDefsContext";
import Sidebar from "@/components/Sidebar";
import TrialBanner from "@/components/TrialBanner";
import { SidebarProvider } from "@/components/SidebarContext";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // This is the REAL auth check — middleware.ts only checked that a cookie
  // exists; this verifies it's genuinely valid and pulls the clinicId/role
  // claims every page under /dashboard needs.
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [clinic, sessionTypeDefs, areaDefs] = await Promise.all([
    getClinic(session.clinicId),
    getClinicSessionTypeDefs(session.clinicId),
    getClinicAreaDefs(session.clinicId),
  ]);
  const clinicName = clinic?.name || "Your Clinic";
  const sessionTypeConfig = buildSessionTypeConfig(sessionTypeDefs);
  // Falls back to "active" if the clinic doc is somehow missing (shouldn't
  // happen outside a broken account) rather than locking someone out of a
  // dashboard that can't even render its own clinic name yet.
  const access = clinic ? getClinicAccess(clinic) : { status: "active" as const };

  return (
    <SidebarProvider>
      <SessionTypeConfigProvider initialConfig={sessionTypeConfig}>
        <AreaDefsProvider initialAreaDefs={areaDefs}>
          <div className="flex h-screen flex-col overflow-hidden bg-canvas">
            <TrialBanner access={access} role={session.role} />
            <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
              <Sidebar clinicName={clinicName} session={session} />
              <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8">{children}</main>
            </div>
          </div>
        </AreaDefsProvider>
      </SessionTypeConfigProvider>
    </SidebarProvider>
  );
}
