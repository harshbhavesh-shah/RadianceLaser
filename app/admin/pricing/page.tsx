import { getPlatformSettingsInfo } from "@/lib/db/platformSettings";
import TierPricingForm from "@/components/admin/TierPricingForm";

export default async function AdminPricingPage() {
  const settings = await getPlatformSettingsInfo();

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-brown-900">Pricing</h1>
      <p className="mt-1 max-w-2xl text-sm text-brown-400">
        What the landing page advertises, what real checkout charges, and what the Clinics
        page&apos;s manual activation logs to the Ledger. One set of numbers, everywhere.
      </p>
      <div className="mt-2 mb-6 h-[2px] w-8 bg-gold-500" />

      <TierPricingForm initialSettings={settings} />
    </div>
  );
}
