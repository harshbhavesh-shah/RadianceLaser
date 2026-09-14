import { getPlatformSettingsInfo } from "@/lib/db/platformSettings";
import TierPricingForm from "@/components/admin/TierPricingForm";

export default async function AdminPricingPage() {
  const settings = await getPlatformSettingsInfo();

  return (
    <div>
      <h1 className="inline-block border-b-4 border-rust-600 pb-1 font-display text-2xl font-bold text-brown-900">
        Pricing
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-brown-400">
        What the landing page advertises, what real checkout charges, and what the Clinics
        page&apos;s manual activation logs to the Ledger. One set of numbers, everywhere.
      </p>

      <div className="mt-8">
        <TierPricingForm initialSettings={settings} />
      </div>
    </div>
  );
}
