import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinic } from "@/lib/db/clinics";
import { getAppointmentsForDate, getAppointmentsInRange } from "@/lib/db/appointments";
import { getVisitsByAppointmentIds, getClinicVisitsSince } from "@/lib/db/visits";
import { getReceiptsByAppointmentIds } from "@/lib/db/receipts";
import { getPackagesPurchasedSince } from "@/lib/db/packages";
import { computeDailyRevenueSummary, computeWeeklyRevenue } from "@/lib/analytics";
import { computeTodayAppointments, computeAppointmentPipelineMaps } from "@/lib/overview";
import { todayLocalStr, toDateStr, getWeekDays, addDays } from "@/lib/calendar";
import TodayAgenda from "@/components/overview/TodayAgenda";
import WeekAgenda from "@/components/overview/WeekAgenda";
import { AppointmentsCard, RevenueTodayCard } from "@/components/overview/StatCards";
import WeeklyRevenueCard from "@/components/overview/WeeklyRevenueCard";
import QuickActionCard from "@/components/overview/QuickActionCard";

// Reception gets today's and this week's appointments only, same as
// before. Owner and doctor also get the at-a-glance stat cards and weekly
// revenue — the rust-on-cream redesign's first real page (see
// tailwind.config.ts and components/overview/ for the new pieces); the
// rest of the dashboard app is unchanged for now.
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/api/auth/force-logout");

  const today = todayLocalStr();
  const yesterday = toDateStr(addDays(new Date(), -1));
  const weekDays = getWeekDays(new Date());
  const weekStart = toDateStr(weekDays[0]);
  const weekEnd = toDateStr(weekDays[6]);

  const [todayAppointmentsRaw, weekAppointments] = await Promise.all([
    getAppointmentsForDate(session.clinicId, today),
    getAppointmentsInRange(session.clinicId, weekStart, weekEnd),
  ]);
  const todayAppointments = computeTodayAppointments(todayAppointmentsRaw, today);
  const todayAppointmentIds = todayAppointments.map((a) => a.id);

  // Today's Appointments keeps its pipeline actions (Log Visit / Generate
  // Receipt), so it still needs to know which of today's appointments
  // already have a visit and/or receipt attached — scoped to just today's
  // ids, not the whole clinic's history.
  const [visitsForToday, receiptsForToday] = await Promise.all([
    getVisitsByAppointmentIds(session.clinicId, todayAppointmentIds),
    getReceiptsByAppointmentIds(session.clinicId, todayAppointmentIds),
  ]);
  const { visitIdByAppointmentId, receiptedAppointmentIds } = computeAppointmentPipelineMaps(
    visitsForToday,
    receiptsForToday
  );

  // TodayAgenda now renders its own "Schedule" card header (matching the
  // dashboard redesign), so this wrapper no longer needs a heading of its
  // own — an outer one would just duplicate it.
  const todaySection = (
    <TodayAgenda
      appointments={todayAppointments}
      visitIdByAppointmentId={visitIdByAppointmentId}
      receiptedAppointmentIds={receiptedAppointmentIds}
    />
  );

  const weekSection = (
    <div>
      <h2 className="text-xl font-extrabold text-brown-900">This Week</h2>
      <div className="mt-1.5 mb-4 h-[3px] w-8 rounded-full bg-rust-600" />
      <WeekAgenda weekDays={weekDays} appointments={weekAppointments} todayStr={today} />
    </div>
  );

  if (session.role === "reception") {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="mt-0 text-3xl font-extrabold tracking-tight text-brown-900">Today</h1>
          <div className="mt-1.5 h-[3px] w-16 bg-rust-600" />
        </div>
        {todaySection}
        {weekSection}
      </div>
    );
  }

  // Covers yesterday through the end of this week in one query — enough
  // for both the day-over-day Revenue Today comparison and the Weekly
  // Revenue bars (Sunday–Saturday, see getWeekDays), whichever start is
  // earlier (yesterday falls in last week whenever today is a Sunday).
  const revenueFetchSince = yesterday < weekStart ? yesterday : weekStart;
  const [clinic, revenueVisits, revenuePackages] = await Promise.all([
    getClinic(session.clinicId),
    getClinicVisitsSince(session.clinicId, revenueFetchSince),
    getPackagesPurchasedSince(session.clinicId, revenueFetchSince),
  ]);
  const dailyRevenue = computeDailyRevenueSummary(revenueVisits, revenuePackages, today, yesterday);
  const weeklyRevenue = computeWeeklyRevenue(revenueVisits, revenuePackages, weekDays);

  const nextAppointment = todayAppointments.find((a) => a.status === "booked") ?? null;
  const todayDateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const nextAppointmentSummary = nextAppointment
    ? { patientName: nextAppointment.patientName, time: nextAppointment.time }
    : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-12">
        {/* Top row, left: page header + Appointments card side by side */}
        <div className="flex w-full flex-col items-start justify-between gap-6 xl:col-span-8 xl:flex-row">
          <div className="flex-shrink-0">
            <h1 className="mt-0 text-3xl font-extrabold tracking-tight text-brown-900">Today at a glance</h1>
            <div className="mt-1.5 h-[3px] w-full bg-rust-600" />
            <p className="mt-3 text-sm font-medium text-brown-400">
              {todayDateLabel} · {clinic?.name || "Your Clinic"}
            </p>
          </div>
          <div className="w-full md:max-w-sm md:flex-1">
            <AppointmentsCard appointmentCount={todayAppointments.length} nextAppointment={nextAppointmentSummary} />
          </div>
        </div>

        {/* Top row, right: Revenue Today card */}
        <div className="w-full xl:col-span-4">
          <RevenueTodayCard revenueToday={dailyRevenue.today} changePct={dailyRevenue.changePct} />
        </div>

        {/* Left column: Schedule (dominant) */}
        <div className="w-full xl:col-span-8">{todaySection}</div>

        {/* Right column: Weekly revenue + quick action */}
        <div className="flex w-full flex-col gap-6 xl:col-span-4">
          <WeeklyRevenueCard weekly={weeklyRevenue} todayByType={dailyRevenue.byType} todayStr={today} />
          <QuickActionCard />
        </div>
      </div>

      <div>{weekSection}</div>
    </div>
  );
}
