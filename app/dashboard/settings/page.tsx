import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinic } from "@/lib/firestore/clinics";
import { getClinicStaff } from "@/lib/firestore/staff";
import { getClinicMachines } from "@/lib/firestore/machines";
import { getClinicSessionTypeDefs } from "@/lib/firestore/sessionTypeDefs";
import ClinicProfileSection from "@/components/settings/ClinicProfileSection";
import StaffSection from "@/components/settings/StaffSection";
import MachinesSection from "@/components/settings/MachinesSection";
import MachineTypesSection from "@/components/settings/MachineTypesSection";
import PatientImportSection from "@/components/settings/PatientImportSection";
import PreferencesSection from "@/components/settings/PreferencesSection";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [clinic, staff, machines, sessionTypeDefs] = await Promise.all([
    getClinic(session.clinicId),
    getClinicStaff(session.clinicId),
    getClinicMachines(session.clinicId),
    getClinicSessionTypeDefs(session.clinicId),
  ]);

  const isOwner = session.role === "owner";

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

        <StaffSection initialStaff={staff} currentUid={session.uid} isOwner={isOwner} />

        <MachineTypesSection
          clinicId={session.clinicId}
          initialSessionTypeDefs={sessionTypeDefs}
          canEdit={isOwner}
        />

        <MachinesSection clinicId={session.clinicId} initialMachines={machines} canEdit={isOwner} />

        <PatientImportSection canEdit={isOwner} />

        <PreferencesSection initialWindow={clinic?.statsWindow || "today"} isOwner={isOwner} />
      </div>
    </div>
  );
}
