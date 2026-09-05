import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinic } from "@/lib/db/clinics";
import { getClinicStaff } from "@/lib/db/staff";
import { getClinicMachines } from "@/lib/db/machines";
import { getClinicSessionTypeDefs } from "@/lib/db/sessionTypeDefs";
import { getClinicPayments } from "@/lib/db/payments";
import { getClinicAccess } from "@/lib/subscription";
import { getAnnualPriceInr } from "@/lib/db/platformSettings";
import ClinicProfileSection from "@/components/settings/ClinicProfileSection";
import StaffSection from "@/components/settings/StaffSection";
import MachinesSection from "@/components/settings/MachinesSection";
import MachineTypesSection from "@/components/settings/MachineTypesSection";
import AreaDefsSection from "@/components/settings/AreaDefsSection";
import PatientImportSection from "@/components/settings/PatientImportSection";
import VisitImportSection from "@/components/settings/VisitImportSection";
import BillingSection from "@/components/settings/BillingSection";
import TwoFactorSection from "@/components/settings/TwoFactorSection";
import ReplayTourSection from "@/components/settings/ReplayTourSection";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [clinic, staff, machines, sessionTypeDefs, payments, annualPriceInr] = await Promise.all([
    getClinic(session.clinicId),
    getClinicStaff(session.clinicId),
    getClinicMachines(session.clinicId),
    getClinicSessionTypeDefs(session.clinicId),
    getClinicPayments(session.clinicId),
    getAnnualPriceInr(),
  ]);

  const isOwner = session.role === "owner";
  const access = clinic ? getClinicAccess(clinic) : ({ status: "active" } as const);
  const currentStaff = staff.find((s) => s.uid === session.uid);

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl font-medium text-brown-900">Settings</h1>
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      {/* Two columns grouped by theme rather than one long stack of ten
          identical-width cards — account/identity on the left, clinic
          configuration on the right. Each column sizes to its own content
          (items-start), so a short card in one column doesn't force
          matching whitespace in the other. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
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
            annualPriceInr={annualPriceInr}
          />

          <StaffSection initialStaff={staff} currentUid={session.uid} isOwner={isOwner} />

          <TwoFactorSection
            initialEnabled={currentStaff?.twoFactorEnabled === true}
            email={session.email || ""}
          />

          <ReplayTourSection role={session.role} />
        </div>

        <div className="space-y-6">
          <MachineTypesSection
            clinicId={session.clinicId}
            initialSessionTypeDefs={sessionTypeDefs}
            canEdit={isOwner}
          />

          <AreaDefsSection canEdit={isOwner} />

          <MachinesSection clinicId={session.clinicId} initialMachines={machines} canEdit={isOwner} />

          <PatientImportSection canEdit={isOwner} />

          <VisitImportSection canEdit={isOwner} />
        </div>
      </div>
    </div>
  );
}
