import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus, CalendarPlus, Search } from "lucide-react";
import { getSession } from "@/lib/session";
import { getClinic } from "@/lib/db/clinics";
import { getPatientsByIds, clinicHasAnyPatient, getClinicPatientCount, getPatientsCreatedSince } from "@/lib/db/patients";
import {
  getRecentClinicVisits,
  getClinicVisitsSince,
  getVisitsByPackageId,
  getVisitsByAppointmentIds,
} from "@/lib/db/visits";
import { getClinicPackages } from "@/lib/db/packages";
import { getAppointmentsForDate, clinicHasAnyAppointment } from "@/lib/db/appointments";
import { getReceiptsByAppointmentIds } from "@/lib/db/receipts";
import { getClinicStaff } from "@/lib/db/staff";
import { computeWindowStats, computeMonthlyRevenue, windowStartStr } from "@/lib/analytics";
import {
  computeTodayAppointments,
  computePackageAlerts,
  computeContraindicationAlerts,
  computeAppointmentPipelineMaps,
  computeTodayGlance,
  computeCashPosition,
} from "@/lib/overview";
import { todayLocalStr } from "@/lib/calendar";
import StatsStrip from "@/components/StatsStrip";
import RevenueChart from "@/components/RevenueChart";
import TodayAgenda from "@/components/overview/TodayAgenda";
import AlertsPanel from "@/components/overview/AlertsPanel";
import QuickActions, { type QuickAction } from "@/components/overview/QuickActions";
import OnboardingChecklist from "@/components/onboarding/OnboardingChecklist";

const WINDOW_LABELS = { today: "Today", week: "This Week", month: "This Month" };

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const today = todayLocalStr();

  // Deliberately NOT a "fetch everything, filter in memory" page anymore —
  // this used to read the clinic's entire patients + visits + appointments
  // + receipts collections on every single load (confirmed 9,000+ reads
  // once real history built up). Everything below is scoped to exactly
  // what this page renders: today's appointments, a handful of recent
  // visits (only to know whether onboarding's "log a treatment session"
  // step is done — Recent Activity itself isn't shown here anymore), and
  // each active package's own redeemed sessions — never the whole history.
  // See lib/db/visits.ts for the reasoning behind each targeted query.
  const [clinic, staff, todayAppointmentsRaw, recentVisits, packages, hasPatients, hasAppointments] =
    await Promise.all([
      getClinic(session.clinicId),
      getClinicStaff(session.clinicId),
      getAppointmentsForDate(session.clinicId, today),
      getRecentClinicVisits(session.clinicId, 8),
      getClinicPackages(session.clinicId),
      clinicHasAnyPatient(session.clinicId),
      clinicHasAnyAppointment(session.clinicId),
    ]);

  const currentStaff = staff.find((s) => s.uid === session.uid);
  const todayAppointments = computeTodayAppointments(todayAppointmentsRaw, today);
  const todayAppointmentIds = todayAppointments.map((a) => a.id);

  // Each active package's own redeemed visits — exactly what
  // computePackageAlerts needs per package, fetched directly by packageId
  // instead of pulling a patient's whole visit history and filtering it
  // down client-side.
  const packageVisits = (
    await Promise.all(packages.map((pkg) => getVisitsByPackageId(session.clinicId, pkg.id)))
  ).flat();

  // Only today's appointments can show up on this page (TodayAgenda), so
  // the pipeline check only needs visits/receipts linked to those, not
  // every visit/receipt the clinic has ever logged.
  const [visitsForTodayAppointments, receiptsForTodayAppointments] = await Promise.all([
    getVisitsByAppointmentIds(session.clinicId, todayAppointmentIds),
    getReceiptsByAppointmentIds(session.clinicId, todayAppointmentIds),
  ]);

  // The one small, targeted patient lookup this page actually needs —
  // every id below comes from a document already scoped to this clinic
  // (today's appointments, a package), never the clinic's whole roster
  // just to label a handful of names. recentVisits isn't included here —
  // it's only used for its length (onboarding's "log a treatment session"
  // step), not rendered, so its patients don't need resolving.
  const patientIds = new Set<string>();
  for (const a of todayAppointments) if (a.patientId) patientIds.add(a.patientId);
  for (const pkg of packages) patientIds.add(pkg.patientId);
  const referencedPatients = await getPatientsByIds([...patientIds]);
  const patientsById = new Map(referencedPatients.map((p) => [p.id, p]));

  // Shown until this person dismisses it (StaffMember.onboardingDismissed)
  // — step completion is derived live from real data below rather than
  // stored, so it can't drift out of sync with what the clinic actually has.
  const onboarding = currentStaff?.onboardingDismissed ? null : (
    <OnboardingChecklist
      role={session.role}
      tourCompleted={currentStaff?.tourCompleted === true}
      hasPatients={hasPatients}
      hasVisits={recentVisits.length > 0}
      hasAppointments={hasAppointments}
      hasTeam={staff.length > 1}
    />
  );

  // The three sections every role sees, in the same order — this is the
  // "morning command center" the rest of the layout branches around.
  //
  // Deliberately not fed by patient follow-ups anymore — this section is
  // meant for things the CLINIC needs attention on (a machine due for
  // scheduled maintenance, a water filter change, etc.), not patient
  // care reminders. That machine-side alerting doesn't exist yet; when it
  // does, it plugs in here. Visit.followUpDate/followUpNote (set from
  // VisitFormModal) are untouched — the data's still recorded, it's just
  // not surfaced here anymore. See lib/overview.ts computeFollowUpAlerts
  // and lib/db/visits.ts getVisitsWithDueFollowUps, both now unused.
  const alerts = [
    ...computeContraindicationAlerts(todayAppointments, patientsById),
    ...computePackageAlerts(packages, packageVisits, patientsById, today),
  ].slice(0, 8);
  const { visitIdByAppointmentId, receiptedAppointmentIds } = computeAppointmentPipelineMaps(
    visitsForTodayAppointments,
    receiptsForTodayAppointments
  );

  // "New Appointment" used to live here too, alongside the "Patient Visit"
  // button above — two entry points into the same booking flow was exactly
  // the kind of ambiguity that let staff wander off the intended pipeline,
  // so it's gone from this row. These two are for the genuinely different
  // cases: filling in a patient's full profile (not just name/phone), and
  // just looking someone up without booking anything.
  const quickActions: QuickAction[] = [
    { label: "New Patient", href: "/dashboard/patients/new", icon: UserPlus },
    { label: "Find a Patient", href: "/dashboard/patients", icon: Search },
  ];

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Header and the day's shortcuts live on one line — the shortcuts are
  // context for "what you might do today," not a separate section to scan.
  //
  // "Patient Visit" is deliberately the one prominent, dark button here —
  // every other action (new patient, find a patient) is a lighter pill.
  // The point is to make the correct pipeline unmistakable regardless of
  // whether the patient is new, existing, walk-in, or pre-booked: start
  // from Schedule, search for them there (an existing patient's name comes
  // straight up; a new one gets created inline via the same search box —
  // see AppointmentFormModal's "no matches" quick-add), and everything
  // else (the visit, the record, the receipt) follows from that one
  // booking. Staff choosing a different starting point is exactly how a
  // new patient ends up created but never actually linked to anything.
  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-medium text-brown-900">{greeting()}</h1>
        <p className="mt-1 text-sm text-brown-600">{todayLabel}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/appointments?newAppointment=1"
          className="flex items-center gap-2 rounded-md bg-brown-900 px-4 py-2.5 text-sm font-semibold text-beige-200 transition-all hover:-translate-y-0.5 hover:bg-gold-600 hover:shadow-card"
        >
          <CalendarPlus size={16} />
          Patient Visit
        </Link>
        <QuickActions actions={quickActions} />
      </div>
    </div>
  );

  const agendaSection = (
    <div>
      <h2 className="font-display text-lg font-medium text-brown-900">Today's Schedule</h2>
      <div className="mt-2 mb-3 h-[2px] w-8 bg-gold-500" />
      <TodayAgenda
        appointments={todayAppointments}
        visitIdByAppointmentId={visitIdByAppointmentId}
        receiptedAppointmentIds={receiptedAppointmentIds}
      />
    </div>
  );

  const alertsSection = (
    <div>
      <h2 className="font-display text-lg font-medium text-brown-900">Needs Attention</h2>
      <div className="mt-2 mb-3 h-[2px] w-8 bg-gold-500" />
      <AlertsPanel alerts={alerts} />
    </div>
  );

  const todaySection = (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">{agendaSection}</div>
      <div>{alertsSection}</div>
    </div>
  );

  // Shared by every role: where today's appointments actually stand,
  // before anyone opens the full agenda below. Purely operational (no
  // money), so reception and doctor get it too, not just the owner.
  const todayGlance = computeTodayGlance(todayAppointments);
  const glanceSection = (
    <StatsStrip
      items={[
        { label: "Today's Appointments", value: todayGlance.total },
        { label: "Completed", value: todayGlance.completed },
        { label: "Remaining", value: todayGlance.remaining },
        { label: "Cancelled / No Show", value: todayGlance.cancelled },
      ]}
    />
  );

  // Reception: pure front-desk view — today's bookings and anything that
  // needs a word with a patient while they're in. No financials, no
  // clinical activity log — that's not what a front-desk shift needs.
  if (session.role === "reception") {
    return (
      <div className="space-y-10">
        {header}
        {onboarding}
        {glanceSection}
        {todaySection}
      </div>
    );
  }

  // Doctor: clinical day-planner — the schedule and anything needing
  // attention come first, business numbers don't show up here at all
  // (Analytics is still one click away for anyone who wants it).
  if (session.role === "doctor") {
    return (
      <div className="space-y-10">
        {header}
        {onboarding}
        {glanceSection}
        {todaySection}
      </div>
    );
  }

  // Owner: everything the clinical/front-desk roles see, plus one clearly
  // separated business section underneath — grouped under its own heading
  // so it reads as one coherent unit, not three unrelated blocks. Only the
  // owner view needs a window of visit/patient history at all, so these
  // fetches are deliberately deferred until here rather than joining the
  // Promise.all every role pays for above.
  const statsWindow = clinic?.statsWindow || "today";
  const windowLabel = WINDOW_LABELS[statsWindow];
  // The earlier of this week's start and this month's start — covers
  // whichever window is actually configured, plus the current month for
  // the revenue chart below, in one query. computeWindowStats/
  // computeMonthlyRevenue each re-filter this down to their own exact
  // range internally, so fetching this superset changes nothing about
  // what they report.
  const scopeStart = [windowStartStr("week"), windowStartStr("month")].sort()[0];
  const [visitsInScope, newPatientsInScope, totalPatients] = await Promise.all([
    getClinicVisitsSince(session.clinicId, scopeStart),
    getPatientsCreatedSince(session.clinicId, new Date(`${scopeStart}T00:00:00`).getTime()),
    getClinicPatientCount(session.clinicId),
  ]);
  const statsBase = computeWindowStats(newPatientsInScope, visitsInScope, packages, statsWindow);
  const stats = { ...statsBase, totalPatients };
  const monthlyRevenue = computeMonthlyRevenue(visitsInScope, packages);
  // visitsInScope always starts at or before today (it's the earlier of
  // this week's and this month's start), so it already covers everything
  // needed for today's own cash position without a separate fetch.
  const cashPosition = computeCashPosition(visitsInScope, packages, today);

  return (
    <div className="space-y-10">
      {header}
      {onboarding}
      {glanceSection}
      {todaySection}

      <div>
        <h2 className="font-display text-lg font-medium text-brown-900">Business Snapshot</h2>
        <div className="mt-2 mb-4 h-[2px] w-8 bg-gold-500" />

        <StatsStrip
          items={[
            { label: `Visits ${windowLabel}`, value: stats.visitsInWindow },
            { label: `New Patients ${windowLabel}`, value: stats.newPatientsInWindow },
            { label: `Revenue ${windowLabel}`, value: formatCurrency(stats.revenueInWindow), accent: true },
            { label: "Total Patients", value: stats.totalPatients },
          ]}
        />

        <div className="mt-6">
          <h3 className="text-sm font-medium uppercase tracking-wide text-brown-500">Today's Cash Position</h3>
          <div className="mt-3">
            <StatsStrip
              items={[
                { label: "Cash", value: formatCurrency(cashPosition.cash) },
                { label: "Online", value: formatCurrency(cashPosition.online) },
                { label: "Unspecified", value: formatCurrency(cashPosition.unspecified) },
                { label: "Total Collected", value: formatCurrency(cashPosition.total), accent: true },
              ]}
            />
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium uppercase tracking-wide text-brown-500">Revenue</h3>
          <div className="mt-3">
            <RevenueChart data={monthlyRevenue} />
          </div>
        </div>
      </div>
    </div>
  );
}
