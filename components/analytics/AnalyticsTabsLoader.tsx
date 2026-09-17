"use client";

import dynamic from "next/dynamic";

// `ssr: false` isn't allowed inside a Server Component (Next 14) — this
// thin client wrapper is what lets app/dashboard/analytics/page.tsx use it
// anyway. Both tabs' default range ("This Month") resolves from
// `new Date()` inside the component, and a Node server's clock can read a
// different day/timezone than the browser's at the exact render moment
// (most visibly right around midnight), which produced a real hydration
// mismatch when this was server-rendered like any other client component.
// Nothing in it needs to be in the initial HTML anyway — it's entirely
// interactive.
const AnalyticsTabs = dynamic(() => import("./AnalyticsTabs"), {
  ssr: false,
  loading: () => <div className="h-96 animate-pulse rounded-2xl border border-beige-300 bg-surface" />,
});

export default AnalyticsTabs;
