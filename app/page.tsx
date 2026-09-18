import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { TRIAL_LENGTH_DAYS } from "@/lib/subscription";
import { getTierPricing } from "@/lib/db/platformSettings";
import SiteHeader from "@/components/marketing/SiteHeader";
import LandingHero from "@/components/marketing/landing/LandingHero";
import NoShowDemo from "@/components/marketing/landing/NoShowDemo";
import DataMigrationSection from "@/components/marketing/landing/DataMigrationSection";
import FeatureGrid from "@/components/marketing/landing/FeatureGrid";
import SecuritySection from "@/components/marketing/landing/SecuritySection";
import WhatsAppScrollSection from "@/components/marketing/landing/WhatsAppScrollSection";
import PricingSection from "@/components/marketing/landing/PricingSection";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const trialMonths = Math.round(TRIAL_LENGTH_DAYS / 30);
  const trialLengthLabel = `${trialMonths} month${trialMonths === 1 ? "" : "s"}`;
  const pricing = await getTierPricing();

  return (
    <div className="flex min-h-screen flex-col bg-canvas selection:bg-rust-600/20">
      <SiteHeader />

      <main className="flex-1">
        <LandingHero trialLengthLabel={trialLengthLabel} />
        <SecuritySection />
        <WhatsAppScrollSection />
        <NoShowDemo />
        <DataMigrationSection />
        <FeatureGrid />
      </main>

      <PricingSection pricing={pricing} />

      {/* Footer — not part of the reference design (its pricing section is
          the last thing on the page), but the legal/compliance links and
          registration details here are real requirements, not something to
          drop for the sake of matching a mockup that never modeled them. */}
      <footer className="mx-auto w-full max-w-6xl border-t border-beige-300 px-6 py-8 text-sm text-brown-400">
        <p>
          © {new Date().getFullYear()} Radiance Laser ·{" "}
          <Link href="/compliance" className="underline decoration-beige-300 underline-offset-2 hover:text-rust-600">
            Data hosted in India, DPDP Act 2023 compliant
          </Link>{" "}
          ·{" "}
          <Link href="/contact" className="underline decoration-beige-300 underline-offset-2 hover:text-rust-600">
            Contact us
          </Link>
        </p>
        <p className="mt-1">
          Udyam Registered: UDYAM-GJ-20-0310289 · Medical Advisor: Dr. Bhavesh Shah (MD Dermatology, DVD)
        </p>
        <p className="mt-1">
          <Link href="/privacy-policy" className="underline decoration-beige-300 underline-offset-2 hover:text-rust-600">
            Privacy Policy
          </Link>{" "}
          ·{" "}
          <Link href="/terms-of-service" className="underline decoration-beige-300 underline-offset-2 hover:text-rust-600">
            Terms of Service
          </Link>
        </p>
      </footer>
    </div>
  );
}
