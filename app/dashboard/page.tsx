import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus, CalendarPlus, Search, ClipboardList } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { getSession } from "@/lib/session";
import { getClinic } from "@/lib/db/clinics";
import { getPatientsByIds, clinicHasAnyPatient, getClinicPatientCount, getPatientsCreatedSince } from "@/lib/db/patients";
import {
  getRecentClinicVisits,
  getClinicVisitsSince,
  getVisitsWithDueFollowUps,
  getVisitsByPackageId,
  getVisitsByAppointmentIds,
} from "@/lib/db/visits";
import { getClinicPackages } from "@/lib/db/packages";
import { getAppointmentsForDate, clinicHasAnyAppointment } from "@/lib/db/appointments";
import { getReceiptsByAppointmentIds } from "@/lib/db/receipts";
import { getClinicStaff } from "@/lib/db/staff";
import { computeWindowStats, computeRecentActivity, computeMonthlyRevenue, windowStartStr } from "@/lib/analytics";
import {
  computeTodayAppointments,
  computePackageAlerts,
  computeContraindicationAlerts,
  computeFollowUpAlerts,
  computeAppointmentPipelineMaps,
} from "@/lib/overview";
import { todayLocalStr } from "@/lib/calendar";
import { getClinicSessionTypeDefs } from "@/lib/db/sessionTypeDefs";
import { buildSessionTypeConfig } from "@/lib/sessionTypes";
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
  // visits, visits actually due for follow-up, and each active package's
  // own redeemed sessions — never the whole history. See
  // lib/db/visits.ts for the reasoning behind each targeted query.
  const [clinic, sessionTypeDefs, staff, todayAppointmentsRaw, recentVisits, dueFollowUpVisits, packages, hasPatients, hasAppointments] =
    await Promise.all([
      getClinic(session.clinicId),
      getClinicSessionTypeDefs(session.clinicId),
      getClinicStaff(session.clinicId),
      getAppointmentsForDate(session.clinicId, today),
      getRecentClinicVisits(session.clinicId, 8),
      getVisitsWithDueFollowUps(session.clinicId, today),
      getClinicPackages(session.clinicId),
      clinicHasAnyPatient(session.clinicId),
      clinicHasAnyAppointment(session.clinicId),
    ]);

  const SESSION_TYPE_CONFIG = buildSessionTypeConfig(sessionTypeDefs);
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
  // (today's appointments, a package, a due follow-up, recent activity),
  // never the clinic's whole roster just to label a handful of names.
  const patientIds = new Set<string>();
  for (const a of todayAppointments) if (a.patientId) patientIds.add(a.patientId);
  for (const v of dueFollowUpVisits) patientIds.add(v.patientId);
  for (const pkg of packages) patientIds.add(pkg.patientId);
  for (const v of recentVisits) patientIds.add(v.patientId);
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
  const alerts = [
    ...computeContraindicationAlerts(todayAppointments, patientsById),
    ...computeFollowUpAlerts(dueFollowUpVisits, patientsById, today),
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

  // Reception: pure front-desk view — today's bookings and anything that
  // needs a word with a patient while they're in. No financials, no
  // clinical activity log — that's not what a front-desk shift needs.
  if (session.role === "reception") {
    return (
      <div className="space-y-10">
        {header}
        {onboarding}
        {todaySection}
      </div>
    );
  }

  // recentVisits' patients are already in patientsById (added above), so
  // this is just the same recent-activity computation as before, over a
  // query that was already scoped to "the last 8" rather than filtered
  // down from the clinic's entire visit history afterward.
  const recentActivity = computeRecentActivity(recentVisits, patientsById);

  // Doctor: clinical day-planner — the schedule and anything needing
  // attention come first, business numbers don't show up here at all
  // (Analytics is still one click away for anyone who wants it).
  if (session.role === "doctor") {
    return (
      <div className="space-y-10">
        {header}
        {onboarding}
        {todaySection}

        <div>
          <h2 className="font-display text-lg font-medium text-brown-900">Recent Activity</h2>
          <div className="mt-2 mb-4 h-[2px] w-8 bg-gold-500" />
          <RecentActivityList activity={recentActivity} config={SESSION_TYPE_CONFIG} />
        </div>
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

  return (
    <div className="space-y-10">
      {header}
      {onboarding}
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

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h3 className="text-sm font-medium uppercase tracking-wide text-brown-500">Recent Activity</h3>
            <div className="mt-3">
              <RecentActivityList activity={recentActivity} config={SESSION_TYPE_CONFIG} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide text-brown-500">Revenue</h3>
            <div className="mt-3">
              <RevenueChart data={monthlyRevenue} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecentActivityList({
  activity,
  config,
}: {
  activity: ReturnType<typeof computeRecentActivity>;
  config: ReturnType<typeof buildSessionTypeConfig>;
}) {
  if (activity.length === 0) {
    return (
      <EmptyState
        compact
        icon={ClipboardList}
        title="No visits logged yet."
        action={{ label: "Go to Patients", href: "/dashboard/patients" }}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-surface shadow-soft ring-1 ring-beige-300">
      {activity.map((item, i) => {
        const cfg = config[item.sessionType];
        return (
          <Link
            key={item.visitId}
            href={`/dashboard/patients/${item.patientId}`}
            className={[
              "flex items-center justify-between px-5 py-3 text-sm transition-colors hover:bg-gold-100/40",
              i !== activity.length - 1 ? "border-b border-beige-300" : "",
            ].join(" ")}
          >
            <span className="flex items-center gap-3">
              {cfg && (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${cfg.badgeClassName}`}>
                  {cfg.badgeText}
                </span>
              )}
              <span className="font-medium text-brown-900">{item.patientName}</span>
            </span>
            <span className="flex items-center gap-4 text-brown-600">
              <span>{item.date || "No date"}</span>
              {item.fee > 0 && <span className="font-medium text-brown-900">{formatCurrency(item.fee)}</span>}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
