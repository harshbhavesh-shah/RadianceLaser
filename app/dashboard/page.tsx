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
import StatCards from "@/components/overview/StatCards";
import WeeklyRevenueCard from "@/components/overview/WeeklyRevenueCard";

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

  const todaySection = (
    <div>
      <h2 className="font-display text-lg font-medium text-brown-900">Today&apos;s Appointments</h2>
      <div className="mt-2 mb-3 h-[2px] w-8 bg-rust-600" />
      <TodayAgenda
        appointments={todayAppointments}
        visitIdByAppointmentId={visitIdByAppointmentId}
        receiptedAppointmentIds={receiptedAppointmentIds}
      />
    </div>
  );

  const weekSection = (
    <div>
      <h2 className="font-display text-lg font-medium text-brown-900">This Week</h2>
      <div className="mt-2 mb-3 h-[2px] w-8 bg-rust-600" />
      <WeekAgenda weekDays={weekDays} appointments={weekAppointments} todayStr={today} />
    </div>
  );

  if (session.role === "reception") {
    return (
      <div className="space-y-10">
        <h1 className="font-display text-2xl font-medium text-brown-900">Today</h1>
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="inline-block border-b-4 border-rust-600 pb-1 font-display text-2xl font-bold text-brown-900">
          Today at a glance
        </h1>
        <p className="mt-2 text-sm text-brown-400">
          {todayDateLabel} · {clinic?.name || "Your Clinic"}
        </p>
      </div>

      <StatCards
        appointmentCount={todayAppointments.length}
        nextAppointment={nextAppointment ? { patientName: nextAppointment.patientName, time: nextAppointment.time } : null}
        revenueToday={dailyRevenue.today}
        changePct={dailyRevenue.changePct}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        {todaySection}
        <div className="lg:mt-[38px]">
          <WeeklyRevenueCard weekly={weeklyRevenue} todayByType={dailyRevenue.byType} todayStr={today} />
        </div>
      </div>

      <div className="mt-10">{weekSection}</div>
    </div>
  );
}
