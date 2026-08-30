import { getAllClinics } from "@/lib/db/clinics";
import ClinicsTable from "@/components/admin/ClinicsTable";

export default async function AdminClinicsPage() {
  const clinics = await getAllClinics();

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-brown-900">Clinics</h1>
      <p className="mt-1 text-sm text-brown-400">
        Every clinic on the platform, its trial/subscription status, and manual overrides.
      </p>
      <div className="mt-2 mb-6 h-[2px] w-8 bg-gold-500" />

      <ClinicsTable clinics={clinics} />
    </div>
  );
}
