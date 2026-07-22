import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { adminDb } from "@/lib/firebase/admin";
import { getClinicSessionTypeDefs } from "@/lib/firestore/sessionTypeDefs";
import { buildSessionTypeConfig } from "@/lib/sessionTypes";
import { SessionTypeConfigProvider } from "@/lib/sessionTypeConfigContext";
import Sidebar from "@/components/Sidebar";
import { SidebarProvider } from "@/components/SidebarContext";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // This is the REAL auth check — middleware.ts only checked that a cookie
  // exists; this verifies it's genuinely valid and pulls the clinicId/role
  // claims every page under /dashboard needs.
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [clinicSnap, sessionTypeDefs] = await Promise.all([
    adminDb().collection("clinics").doc(session.clinicId).get(),
    getClinicSessionTypeDefs(session.clinicId),
  ]);
  const clinicName = clinicSnap.exists ? (clinicSnap.data()?.name as string) : "Your Clinic";
  const sessionTypeConfig = buildSessionTypeConfig(sessionTypeDefs);

  return (
    <SidebarProvider>
      <SessionTypeConfigProvider initialConfig={sessionTypeConfig}>
        <div className="flex h-screen flex-col overflow-hidden bg-canvas md:flex-row">
          <Sidebar clinicName={clinicName} session={session} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8">{children}</main>
        </div>
      </SessionTypeConfigProvider>
    </SidebarProvider>
  );
}
