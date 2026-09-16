import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

// Matches the "Quick Action" card in the dashboard redesign (design/
// DashboardOverviewDesign) — its mockup labeled the button "Run Report"
// implying a generated PDF, which doesn't exist in this app. Linking to
// the real Analytics page (which already has this week's full
// schedule/treatment/revenue breakdown) is the honest equivalent instead
// of a button that looks like it does something it doesn't.
export default function QuickActionCard() {
  return (
    <div className="flex flex-col items-start rounded-[18px] border border-beige-300 bg-surface p-6 shadow-soft">
      <h3 className="mb-2 text-lg font-extrabold text-brown-900">Weekly Analytics</h3>
      <p className="mb-5 text-sm font-medium text-brown-400">
        See the full breakdown of this week&apos;s schedules, treatments, and revenue.
      </p>
      <Link
        href="/dashboard/analytics"
        className="inline-flex items-center gap-2 rounded-xl bg-rust-600 px-4 py-2.5 text-sm font-bold text-white shadow-soft transition-colors hover:bg-rust-600/90"
      >
        View Analytics
        <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
      </Link>
    </div>
  );
}
