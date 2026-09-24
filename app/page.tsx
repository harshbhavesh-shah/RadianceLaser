import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { TRIAL_LENGTH_DAYS } from "@/lib/subscription";
import { getTierPricing } from "@/lib/db/platformSettings";
import { landingFontVariables } from "@/components/marketing/landing/fonts";
import LandingHeader from "@/components/marketing/landing/LandingHeader";
import LandingHero from "@/components/marketing/landing/LandingHero";
import SecuritySection from "@/components/marketing/landing/SecuritySection";
import WhatsAppSection from "@/components/marketing/landing/WhatsAppSection";
import NoShowDemo from "@/components/marketing/landing/NoShowDemo";
import DataMigrationSection from "@/components/marketing/landing/DataMigrationSection";
import FeatureGrid from "@/components/marketing/landing/FeatureGrid";
import PricingSection from "@/components/marketing/landing/PricingSection";
import OriginSection from "@/components/marketing/landing/OriginSection";
import LandingFooter from "@/components/marketing/landing/LandingFooter";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const trialMonths = Math.round(TRIAL_LENGTH_DAYS / 30);
  const trialLengthLabel = `${trialMonths} month${trialMonths === 1 ? "" : "s"}`;
  const pricing = await getTierPricing();

  return (
    <div
      className={`${landingFontVariables} flex min-h-screen flex-col overflow-x-clip bg-lumi-paper font-landing text-lumi-ink antialiased selection:bg-lumi-accent/20`}
    >
      <LandingHeader trialLengthLabel={trialLengthLabel} />
      <main className="flex-1">
        <LandingHero trialLengthLabel={trialLengthLabel} />
        <SecuritySection />
        <WhatsAppSection />
        <NoShowDemo />
        <DataMigrationSection />
        <FeatureGrid />
        <PricingSection pricing={pricing} />
        <OriginSection />
      </main>
      <LandingFooter />
    </div>
  );
}
