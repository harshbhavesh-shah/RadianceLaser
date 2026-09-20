#!/usr/bin/env node
/**
 * Tops up the standing "Lumière Aesthétique" demo clinic with data dated
 * exactly TODAY. scripts/topUpDemoClinic.mjs spreads its appointments and
 * revenue across a rolling past/future window computed at the time it was
 * run, so whenever today has moved on since the last run, the "Today at a
 * glance" dashboard (app/dashboard/page.tsx) goes back to looking empty:
 * its Revenue Today / Weekly Revenue / Today's Breakdown widgets all key
 * off a Visit.date or Package.purchaseDate exactly equal to today's date
 * string, not off any appointment field, so having today-dated
 * appointments alone isn't enough to populate them (see lib/analytics.ts
 * revenueOnDate). This script only ever adds new rows dated today — safe
 * to re-run any day the dashboard looks sparse again.
 *
 * Usage:
 *   node scripts/topUpTodayDemo.mjs
 *
 * Requires .env.local to be filled in with DATABASE_URL.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { ca: readFileSync("global-bundle.pem", "utf-8"), rejectUnauthorized: true },
  });
  return new PrismaClient({ adapter });
}

const DEMO_CLINIC_NAME = "Lumière Aesthétique";

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const LHR_AREAS = ["Upper Lip", "Chin", "Underarms", "Full Face", "Full Arms", "Full Legs", "Bikini Line", "Back"];
const QS_AREAS = ["Full Face", "Pigmentation Spot", "Tattoo Removal — Forearm", "Under Eye", "Neck"];
const HYDRAFACIAL_AREAS = ["Full Face", "Face & Neck"];

function areaFor(sessionType) {
  if (sessionType === "lhr") return pick(LHR_AREAS);
  if (sessionType === "hydrafacial") return pick(HYDRAFACIAL_AREAS);
  return pick(QS_AREAS);
}
function feeFor(sessionType) {
  if (sessionType === "lhr") return pick([1200, 1500, 1800, 2200, 2800, 3500]);
  if (sessionType === "hydrafacial") return pick([2500, 3500, 4500]);
  return pick([800, 1200, 1800, 2500, 4000, 6000]);
}

async function allocateReceiptNumber(prisma, clinicId) {
  const rows = await prisma.$queryRaw`
    INSERT INTO "receipt_counters" ("clinicId", "value")
    VALUES (${clinicId}, 1)
    ON CONFLICT ("clinicId") DO UPDATE SET "value" = "receipt_counters"."value" + 1
    RETURNING "value"
  `;
  return `RCPT-${String(rows[0].value).padStart(6, "0")}`;
}

// Spread across the working day so the Schedule/Calendar views also look
// busy, not just the revenue widgets: a few already-done earlier slots, one
// happening around now, and several still upcoming later today.
const TODAY_SLOTS = [
  { hour: 10, minute: "00", status: "completed" },
  { hour: 10, minute: "45", status: "completed" },
  { hour: 11, minute: "30", status: "no-show" },
  { hour: 12, minute: "15", status: "completed" },
  { hour: 13, minute: "00", status: "completed" },
  { hour: 14, minute: "30", status: "booked" },
  { hour: 15, minute: "15", status: "booked" },
  { hour: 16, minute: "00", status: "booked" },
  { hour: 17, minute: "30", status: "booked" },
  { hour: 18, minute: "15", status: "booked" },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL in .env.local");
    process.exit(1);
  }
  const prisma = createPrismaClient();

  console.log("=== Finding the existing demo clinic ===");
  const clinic = await prisma.clinic.findFirst({ where: { name: DEMO_CLINIC_NAME } });
  if (!clinic) {
    console.error(`No clinic named "${DEMO_CLINIC_NAME}" found — run scripts/seedDemoClinic.mjs first.`);
    process.exit(1);
  }
  console.log(`✓ Found "${clinic.name}" (id: ${clinic.id})`);

  const staff = await prisma.staffMember.findMany({ where: { clinicId: clinic.id } });
  if (staff.length === 0) {
    console.error("This clinic has no staff — can't attribute visits/receipts to anyone. Aborting.");
    process.exit(1);
  }
  const doctors = staff.filter((s) => s.role !== "reception");

  const patients = await prisma.patient.findMany({ where: { clinicId: clinic.id }, select: { id: true, name: true, phone: true, age: true, gender: true, address: true } });
  if (patients.length === 0) {
    console.error("This clinic has no patients — run scripts/topUpDemoClinic.mjs first to create some.");
    process.exit(1);
  }

  const existingMachines = await prisma.machine.findMany({ where: { clinicId: clinic.id } });
  const sessionTypesAvailable = [...new Set(existingMachines.map((m) => m.sessionType))];
  if (sessionTypesAvailable.length === 0) sessionTypesAvailable.push("qs", "lhr");
  function machineFor(sessionType) {
    const candidates = existingMachines.filter((m) => m.sessionType === sessionType);
    return candidates.length ? pick(candidates) : null;
  }

  const today = todayStr();
  console.log(`\n=== Adding appointments + revenue for today (${today}) ===`);

  const existingToday = await prisma.appointment.count({ where: { clinicId: clinic.id, date: today } });
  console.log(`✓ Clinic currently has ${existingToday} appointment(s) dated today`);

  let apptCount = 0;
  let visitCount = 0;
  let receiptCount = 0;
  const usedPatients = new Set();

  for (const slot of TODAY_SLOTS) {
    let patient = pick(patients);
    // Avoid double-booking the same patient twice today across this batch.
    let attempts = 0;
    while (usedPatients.has(patient.id) && attempts < 5) {
      patient = pick(patients);
      attempts++;
    }
    usedPatients.add(patient.id);

    const sessionType = pick(sessionTypesAvailable);
    const time = `${String(slot.hour).padStart(2, "0")}:${slot.minute}`;
    const durationMinutes = pick([30, 45, 60]);

    const appt = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        sessionType,
        date: today,
        time,
        durationMinutes,
        status: slot.status,
        createdAt: BigInt(Date.now()),
      },
    });
    apptCount++;

    if (slot.status !== "completed") continue;

    // A completed appointment today gets a real logged visit + receipt, so
    // Revenue Today / Weekly Revenue / Today's Breakdown all pick it up.
    const area = areaFor(sessionType);
    const fee = feeFor(sessionType);
    const fields = { area, fee };
    if (sessionType === "qs") {
      fields.carbon = pick(["Yes", "No"]);
      fields.mode = pick(["Q-Mode", "S-Mode"]);
      fields.hp = String(randInt(1, 5));
      fields.eng = randInt(6, 12);
      fields.pass = randInt(2, 4);
      fields.repeat = randInt(1, 3);
    } else if (sessionType === "lhr") {
      fields.hr = randInt(8, 14);
      fields.shr = randInt(2, 6);
      fields.stack = randInt(1, 3);
    } else {
      fields.intensity = pick(["Low", "Medium", "High"]);
    }

    const staffMember = pick(doctors.length ? doctors : staff);
    const visit = await prisma.visit.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        sessionType,
        date: today,
        fields,
        areas: [{ fields }],
        appointmentId: appt.id,
        machineId: machineFor(sessionType)?.id ?? null,
        performedByUid: staffMember.id,
        performedByName: staffMember.name,
        durationMinutes,
        paymentMethod: pick(["cash", "online"]),
        followUpDate: null,
        followUpNote: null,
        createdAt: BigInt(Date.now()),
      },
    });
    visitCount++;

    const receiptNumber = await allocateReceiptNumber(prisma, clinic.id);
    const issuer = pick(staff);
    await prisma.receipt.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        patientAge: patient.age,
        patientGender: patient.gender,
        patientAddress: patient.address,
        consultingDoctor: staffMember.name,
        receiptNumber,
        date: today,
        items: [{ description: `${sessionType.toUpperCase()} — ${area} (${today})`, amount: fee, discount: 0 }],
        amount: fee,
        visitId: visit.id,
        appointmentId: appt.id,
        issuedByUid: issuer.id,
        issuedByName: issuer.name,
        createdAt: BigInt(Date.now()),
      },
    });
    receiptCount++;
    console.log(`✓ ${time} — ${patient.name} (${sessionType.toUpperCase()}) — completed, ₹${fee} receipt`);
  }

  console.log(`\n✓ Created ${apptCount} appointments, ${visitCount} visits, ${receiptCount} receipts dated ${today}`);

  const todayRevenue = await prisma.receipt.aggregate({ where: { clinicId: clinic.id, date: today }, _sum: { amount: true } });
  const todayApptCount = await prisma.appointment.count({ where: { clinicId: clinic.id, date: today } });

  console.log("\n=== Done ===");
  console.log(`Clinic: ${clinic.name} (${clinic.id})`);
  console.log(`Appointments today: ${todayApptCount}`);
  console.log(`Revenue today: ₹${Math.round(todayRevenue._sum.amount || 0).toLocaleString("en-IN")}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
