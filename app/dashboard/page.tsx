import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus, CalendarPlus, Search } from "lucide-react";
import { getSession } from "@/lib/session";
import { getClinic } from "@/lib/firestore/clinics";
import { getPatients } from "@/lib/firestore/patients";
import { getClinicVisits } from "@/lib/firestore/visits";
import { getClinicPackages } from "@/lib/firestore/packages";
import { getClinicAppointments } from "@/lib/firestore/appointments";
import { getClinicReceipts } from "@/lib/firestore/receipts";
import { computeWindowStats, computeRecentActivity, computeMonthlyRevenue } from "@/lib/analytics";
import {
  computeTodayAppointments,
  computePackageAlerts,
  computeContraindicationAlerts,
  computeAppointmentPipelineMaps,
} from "@/lib/overview";
import { todayLocalStr } from "@/lib/calendar";
import { getClinicSessionTypeDefs } from "@/lib/firestore/sessionTypeDefs";
import { buildSessionTypeConfig } from "@/lib/sessionTypes";
import StatsStrip from "@/components/StatsStrip";
import RevenueChart from "@/components/RevenueChart";
import TodayAgenda from "@/components/overview/TodayAgenda";
import AlertsPanel from "@/components/overview/AlertsPanel";
import QuickActions, { type QuickAction } from "@/components/overview/QuickActions";

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

  const [clinic, patients, visits, packages, appointments, receipts, sessionTypeDefs] = await Promise.all([
    getClinic(session.clinicId),
    getPatients(session.clinicId),
    getClinicVisits(session.clinicId),
    getClinicPackages(session.clinicId),
    getClinicAppointments(session.clinicId),
    getClinicReceipts(session.clinicId),
    getClinicSessionTypeDefs(session.clinicId),
  ]);
  const SESSION_TYPE_CONFIG = buildSessionTypeConfig(sessionTypeDefs);

  const patientsById = new Map(patients.map((p) => [p.id, p]));
  const today = todayLocalStr();

  // The three sections every role sees, in the same order — this is the
  // "morning command center" the rest of the layout branches around.
  const todayAppointments = computeTodayAppointments(appointments, today);
  const alerts = [
    ...computeContraindicationAlerts(todayAppointments, patientsById),
    ...computePackageAlerts(packages, visits, patientsById, today),
  ].slice(0, 8);
  const { visitIdByAppointmentId, receiptedAppointmentIds } = computeAppointmentPipelineMaps(visits, receipts);

  const quickActionsBase: QuickAction[] = [
    { label: "New Appointment", href: "/dashboard/appointments", icon: CalendarPlus },
    { label: "New Patient", href: "/dashboard/patients/new", icon: UserPlus },
    { label: "Find a Patient", href: "/dashboard/patients", icon: Search },
  ];
  // Reception's day starts with booking/checking people in, so that action
  // leads; everyone else starts with clinical/admin work, so patient lookup
  // leads instead.
  const quickActions =
    session.role === "reception"
      ? quickActionsBase
      : [quickActionsBase[1], quickActionsBase[0], quickActionsBase[2]];

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Header and the day's shortcuts live on one line — the shortcuts are
  // context for "what you might do today," not a separate section to scan.
  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-medium text-brown-900">{greeting()}</h1>
        <p className="mt-1 text-sm text-brown-600">{todayLabel}</p>
      </div>
      <QuickActions actions={quickActions} />
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
        {todaySection}
      </div>
    );
  }

  const recentActivity = computeRecentActivity(visits, patientsById);

  // Doctor: clinical day-planner — the schedule and anything needing
  // attention come first, business numbers don't show up here at all
  // (Analytics is still one click away for anyone who wants it).
  if (session.role === "doctor") {
    return (
      <div className="space-y-10">
        {header}
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
  // so it reads as one coherent unit, not three unrelated blocks.
  const statsWindow = clinic?.statsWindow || "today";
  const windowLabel = WINDOW_LABELS[statsWindow];
  const stats = computeWindowStats(patients, visits, packages, statsWindow);
  const monthlyRevenue = computeMonthlyRevenue(visits, packages);

  return (
    <div className="space-y-10">
      {header}
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
      <div className="rounded-xl bg-surface p-8 text-center shadow-soft ring-1 ring-beige-300">
        <p className="text-sm text-brown-600">No visits logged yet.</p>
        <Link href="/dashboard/patients" className="mt-2 inline-block text-sm font-medium text-gold-600 hover:underline">
          Go to Patients
        </Link>
      </div>
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
