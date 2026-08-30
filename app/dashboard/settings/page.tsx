import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinic } from "@/lib/db/clinics";
import { getClinicStaff } from "@/lib/db/staff";
import { getClinicMachines } from "@/lib/db/machines";
import { getClinicSessionTypeDefs } from "@/lib/db/sessionTypeDefs";
import { getClinicPayments } from "@/lib/firestore/payments";
import { getClinicAccess } from "@/lib/subscription";
import ClinicProfileSection from "@/components/settings/ClinicProfileSection";
import StaffSection from "@/components/settings/StaffSection";
import MachinesSection from "@/components/settings/MachinesSection";
import MachineTypesSection from "@/components/settings/MachineTypesSection";
import PatientImportSection from "@/components/settings/PatientImportSection";
import VisitImportSection from "@/components/settings/VisitImportSection";
import PreferencesSection from "@/components/settings/PreferencesSection";
import BillingSection from "@/components/settings/BillingSection";
import TwoFactorSection from "@/components/settings/TwoFactorSection";
import ReplayTourSection from "@/components/settings/ReplayTourSection";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [clinic, staff, machines, sessionTypeDefs, payments] = await Promise.all([
    getClinic(session.clinicId),
    getClinicStaff(session.clinicId),
    getClinicMachines(session.clinicId),
    getClinicSessionTypeDefs(session.clinicId),
    getClinicPayments(session.clinicId),
  ]);

  const isOwner = session.role === "owner";
  const access = clinic ? getClinicAccess(clinic) : ({ status: "active" } as const);
  const currentStaff = staff.find((s) => s.uid === session.uid);

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-medium text-brown-900">Settings</h1>
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      <div className="space-y-6">
        <ClinicProfileSection
          initialName={clinic?.name || ""}
          initialAddress={clinic?.address || ""}
          isOwner={isOwner}
        />

        <BillingSection
          access={access}
          isOwner={isOwner}
          clinicName={clinic?.name || "Your Clinic"}
          ownerEmail={session.email || ""}
          payments={payments}
        />

        <StaffSection initialStaff={staff} currentUid={session.uid} isOwner={isOwner} />

        <TwoFactorSection
          initialEnabled={currentStaff?.twoFactorEnabled === true}
          email={session.email || ""}
        />

        <ReplayTourSection role={session.role} />

        <MachineTypesSection
          clinicId={session.clinicId}
          initialSessionTypeDefs={sessionTypeDefs}
          canEdit={isOwner}
        />

        <MachinesSection clinicId={session.clinicId} initialMachines={machines} canEdit={isOwner} />

        <PatientImportSection canEdit={isOwner} />

        <VisitImportSection canEdit={isOwner} />

        <PreferencesSection initialWindow={clinic?.statsWindow || "today"} isOwner={isOwner} />
      </div>
    </div>
  );
}
