import { getPlatformSettingsInfo } from "@/lib/db/platformSettings";
import PricingForm from "@/components/admin/PricingForm";
import TierPricingForm from "@/components/admin/TierPricingForm";

export default async function AdminPricingPage() {
  const settings = await getPlatformSettingsInfo();

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-brown-900">Pricing</h1>
      <p className="mt-1 text-sm text-brown-400">
        Two separate things: the checkout price below is what self-serve signup actually
        charges today (real per-tier billing hasn't shipped yet), while tier pricing further
        down is what the landing page advertises for each plan.
      </p>
      <div className="mt-2 mb-6 h-[2px] w-8 bg-gold-500" />

      <PricingForm initialSettings={settings} />
      <TierPricingForm initialPricing={settings} />
    </div>
  );
}
