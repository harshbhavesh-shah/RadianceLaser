import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinicPackageTypeDefs } from "@/lib/db/packageTypeDefs";
import { getClinicSessionTypeDefs } from "@/lib/db/sessionTypeDefs";
import { buildSessionTypeConfig } from "@/lib/sessionTypes";
import PackageTypesManager from "@/components/packages/PackageTypesManager";

export default async function PackagesPage() {
  const session = await getSession();
  if (!session) redirect("/api/auth/force-logout");

  const [packageTypeDefs, sessionTypeDefs] = await Promise.all([
    getClinicPackageTypeDefs(session.clinicId),
    getClinicSessionTypeDefs(session.clinicId),
  ]);
  const sessionTypeConfig = buildSessionTypeConfig(sessionTypeDefs);

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-brown-900">Packages</h1>
      <p className="mt-1 text-sm text-brown-400">
        Reusable package presets your clinic sells — Bridal Package, Holiday Package, and so on.
        Selling one to a specific patient still happens from their own profile.
      </p>
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      <PackageTypesManager
        initialPackageTypeDefs={packageTypeDefs}
        sessionTypeConfig={sessionTypeConfig}
        canEdit={session.role === "owner"}
      />
    </div>
  );
}
