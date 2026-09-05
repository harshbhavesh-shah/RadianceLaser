import { getAnnualPriceInr } from "@/lib/db/platformSettings";
import SignUpForm from "@/components/auth/SignUpForm";

// Thin server wrapper — the actual form (Google/email flows, 2FA stage,
// etc.) is all client-side state in SignUpForm, but the price shown here
// needs a live DB read (see lib/db/platformSettings.ts), which a "use
// client" page can't do directly.
export default async function SignUpPage() {
  const annualPriceInr = await getAnnualPriceInr();
  return <SignUpForm annualPriceInr={annualPriceInr} />;
}
