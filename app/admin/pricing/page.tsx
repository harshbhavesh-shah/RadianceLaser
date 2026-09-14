import { getPlatformSettingsInfo } from "@/lib/db/platformSettings";
import PricingForm from "@/components/admin/PricingForm";
import TierPricingForm from "@/components/admin/TierPricingForm";

export default async function AdminPricingPage() {
  const settings = await getPlatformSettingsInfo();

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-brown-900">Pricing</h1>
      <p className="mt-1 max-w-2xl text-sm text-brown-400">
        Tier pricing is the real, live number, it's what the landing page advertises and what
        checkout actually charges. Manual activation is a narrower leftover, used only for the
        Clinics page&apos;s one-click yearly activation.
      </p>
      <div className="mt-2 mb-6 h-[2px] w-8 bg-gold-500" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.4fr] xl:items-start">
        <PricingForm initialSettings={settings} />
        <TierPricingForm initialSettings={settings} />
      </div>
    </div>
  );
}
