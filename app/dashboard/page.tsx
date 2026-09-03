import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAppointmentsForDate, getAppointmentsInRange } from "@/lib/db/appointments";
import { getVisitsByAppointmentIds, getClinicVisitsSince } from "@/lib/db/visits";
import { getReceiptsByAppointmentIds } from "@/lib/db/receipts";
import { getPackagesPurchasedSince } from "@/lib/db/packages";
import { computeMonthlyRevenue } from "@/lib/analytics";
import { computeTodayAppointments, computeAppointmentPipelineMaps } from "@/lib/overview";
import { todayLocalStr, toDateStr, getWeekDays } from "@/lib/calendar";
import TodayAgenda from "@/components/overview/TodayAgenda";
import WeekAgenda from "@/components/overview/WeekAgenda";
import RevenueChart from "@/components/RevenueChart";

// Deliberately just three things: today's appointments, this week's
// appointments, and revenue. Everything the previous dashboard also
// carried — onboarding, alerts, cash-position breakdown, a configurable
// stats window — is gone, not hidden behind a flag. Reception gets the
// two appointment sections only; doctor and owner also get revenue.
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const today = todayLocalStr();
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
      <h2 className="font-display text-lg font-medium text-brown-900">Today's Appointments</h2>
      <div className="mt-2 mb-3 h-[2px] w-8 bg-gold-500" />
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
      <div className="mt-2 mb-3 h-[2px] w-8 bg-gold-500" />
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

  const monthStart = toDateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [visitsThisMonth, packagesThisMonth] = await Promise.all([
    getClinicVisitsSince(session.clinicId, monthStart),
    getPackagesPurchasedSince(session.clinicId, monthStart),
  ]);
  const monthlyRevenue = computeMonthlyRevenue(visitsThisMonth, packagesThisMonth);

  const revenueSection = (
    <div>
      <h2 className="font-display text-lg font-medium text-brown-900">Revenue</h2>
      <div className="mt-2 mb-3 h-[2px] w-8 bg-gold-500" />
      <RevenueChart data={monthlyRevenue} />
    </div>
  );

  return (
    <div className="space-y-10">
      <h1 className="font-display text-2xl font-medium text-brown-900">Today</h1>
      {todaySection}
      {weekSection}
      {revenueSection}
    </div>
  );
}
