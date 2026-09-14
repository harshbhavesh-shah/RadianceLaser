import { getTierPricing } from "@/lib/db/platformSettings";
import SignUpForm from "@/components/auth/SignUpForm";

// Thin server wrapper — the actual form (Google/email flows, 2FA stage,
// etc.) is all client-side state in SignUpForm, but the price shown here
// needs a live DB read (see lib/db/platformSettings.ts), which a "use
// client" page can't do directly. Basic's price, not a single flat number
// — the trial settles onto the free tier automatically, and paid plans
// start at Basic, not one fixed annual charge (see lib/entitlements.ts).
export default async function SignUpPage() {
  const { basicPriceInr } = await getTierPricing();
  return <SignUpForm startingPriceInr={basicPriceInr} />;
}
