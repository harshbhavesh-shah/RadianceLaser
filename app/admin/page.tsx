import { getAllClinics } from "@/lib/db/clinics";
import { getTierPricing } from "@/lib/db/platformSettings";
import { getClinicOwnerEmails } from "@/lib/db/staff";
import ClinicsTable from "@/components/admin/ClinicsTable";

export default async function AdminClinicsPage() {
  const [clinics, tierPricing] = await Promise.all([getAllClinics(), getTierPricing()]);
  const ownerEmails = await getClinicOwnerEmails(clinics.map((c) => c.id));

  return (
    <div>
      <h1 className="inline-block border-b-4 border-rust-600 pb-1 font-display text-2xl font-bold text-brown-900">
        Clinics
      </h1>
      <p className="mt-3 text-sm text-brown-400">
        Every clinic on the platform, its trial/subscription status, and manual overrides.
      </p>

      <div className="mt-8">
        <ClinicsTable clinics={clinics} tierPricing={tierPricing} ownerEmails={ownerEmails} />
      </div>
    </div>
  );
}
