import { getPlatformSettingsInfo } from "@/lib/db/platformSettings";
import PricingForm from "@/components/admin/PricingForm";

export default async function AdminPricingPage() {
  const settings = await getPlatformSettingsInfo();

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-brown-900">Pricing</h1>
      <p className="mt-1 text-sm text-brown-400">
        The one annual price, read everywhere it's shown or charged — the landing page, signup page, dashboard
        billing, and what Razorpay actually bills. Change it once here.
      </p>
      <div className="mt-2 mb-6 h-[2px] w-8 bg-gold-500" />

      <PricingForm initialSettings={settings} />
    </div>
  );
}
