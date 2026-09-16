#!/usr/bin/env node
/**
 * Adds MORE realistic demo data to the existing, standing "Lumière
 * Aesthétique" demo clinic — unlike scripts/seedDemoClinic.mjs, which
 * always creates a brand-new clinic from scratch, this tops up the one
 * that already exists, preserving its real connected WhatsApp integration
 * and its 4 staff logins (both would be lost/duplicated by re-running
 * seedDemoClinic.mjs, since it unconditionally creates a fresh clinic and
 * tries to create Firebase Auth users that already exist).
 *
 * Adds: package type presets (Settings → Packages — the original seed
 * never created any), 2 more machines per existing treatment type, a
 * batch of new patients, packages + visits + receipts for them (real
 * revenue), and a fresh batch of appointments spanning past/today/
 * upcoming. Reuses the clinic's existing staff and machines rather than
 * creating new ones. Safe to re-run — every patient/appointment/etc. it
 * creates is new, nothing existing is touched or duplicated (checked
 * against existing package-type-preset names before inserting).
 *
 * Usage:
 *   node scripts/topUpDemoClinic.mjs
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

const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_CLINIC_NAME = "Lumière Aesthétique";

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickWeighted(pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [value, weight] of pairs) {
    if (r < weight) return value;
    r -= weight;
  }
  return pairs[pairs.length - 1][0];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function daysAgo(n) {
  return Date.now() - n * DAY_MS;
}
function daysFromNow(n) {
  return Date.now() + n * DAY_MS;
}
function dateStr(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function randomTime() {
  const hour = pick([10, 11, 12, 13, 16, 17, 18, 19]);
  const minute = pick(["00", "15", "30", "45"]);
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

const PATIENT_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generatePatientCode() {
  let code = "";
  for (let i = 0; i < 6; i++) code += PATIENT_CODE_CHARS.charAt(Math.floor(Math.random() * PATIENT_CODE_CHARS.length));
  return `PT-${code}`;
}
function normalizePhone(phone) {
  return phone.replace(/\D/g, "");
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

const FIRST_NAMES_F = [
  "Aanya", "Zara", "Myra", "Anvi", "Diya", "Saanvi", "Avni", "Navya",
  "Kiara", "Tara", "Vanya", "Ira", "Naina", "Palak", "Radhika", "Isha",
];
const FIRST_NAMES_M = [
  "Advait", "Vihaan", "Atharv", "Shaurya", "Krish", "Parth", "Rudra", "Laksh",
  "Om", "Veer", "Zain", "Neel", "Samar", "Dhruv", "Kian", "Arnav",
];
const LAST_NAMES = [
  "Kulkarni", "Patel", "Singh", "Khanna", "Saxena", "Tiwari", "Bajaj", "Chawla",
  "Ahluwalia", "Bhatt", "Dutta", "Ganguly", "Mistry", "Pandey", "Rane", "Sethi",
];
const CITIES_AREAS = ["Khar", "Santa Cruz", "Worli", "Colaba", "Chembur", "Goregaon", "Dadar", "Kandivali"];
const CONTRAINDICATIONS = [
  "Recently had chemical peel — wait 4 weeks before laser",
  "Diabetic — monitor healing time closely",
  "Sensitive skin — always patch test 48h before full session",
  "On accutane in the last 6 months — laser hold",
];
const LHR_AREAS = ["Upper Lip", "Chin", "Underarms", "Full Face", "Full Arms", "Full Legs", "Bikini Line", "Back"];
const QS_AREAS = ["Full Face", "Pigmentation Spot", "Tattoo Removal — Forearm", "Under Eye", "Neck"];
const HYDRAFACIAL_AREAS = ["Full Face", "Face & Neck"];

function randomName(gender) {
  const first = gender === "F" ? pick(FIRST_NAMES_F) : pick(FIRST_NAMES_M);
  return `${first} ${pick(LAST_NAMES)}`;
}
function randomPhone(existingPhones) {
  let phone;
  do {
    phone = `9${randInt(0, 9)}${randInt(0, 9)}${randInt(0, 9)}${randInt(0, 9)}${randInt(0, 9)}${randInt(0, 9)}${randInt(0, 9)}${randInt(0, 9)}${randInt(0, 9)}`;
  } while (existingPhones.has(phone));
  existingPhones.add(phone);
  return phone;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL in .env.local");
    process.exit(1);
  }
  const prisma = createPrismaClient();

  console.log("=== Finding the existing demo clinic ===");
  const clinic = await prisma.clinic.findFirst({ where: { name: DEMO_CLINIC_NAME } });
  if (!clinic) {
    console.error(`No clinic named "${DEMO_CLINIC_NAME}" found — run scripts/seedDemoClinic.mjs first to create it.`);
    process.exit(1);
  }
  console.log(`✓ Found "${clinic.name}" (id: ${clinic.id})`);

  const staff = await prisma.staffMember.findMany({ where: { clinicId: clinic.id } });
  if (staff.length === 0) {
    console.error("This clinic has no staff — can't attribute visits/receipts to anyone. Aborting.");
    process.exit(1);
  }
  const doctors = staff.filter((s) => s.role !== "reception");
  console.log(`✓ Reusing ${staff.length} existing staff members`);

  const existingSessionTypes = await prisma.sessionTypeDef.findMany({ where: { clinicId: clinic.id } });
  console.log(`✓ Found ${existingSessionTypes.length} existing custom treatment type(s): ${existingSessionTypes.map((t) => t.key).join(", ") || "none"}`);

  console.log("\n=== 1. More machines (clinic growth — a second unit of each type) ===");
  const existingMachines = await prisma.machine.findMany({ where: { clinicId: clinic.id } });
  const sessionTypesInUse = [...new Set(existingMachines.map((m) => m.sessionType))];
  const machineNameBases = {
    qs: "Q-Switch Nd:YAG",
    lhr: "Soprano Ice Platinum",
    hydrafacial: "HydraFacial MD",
  };
  const newMachines = [];
  for (const sessionType of sessionTypesInUse) {
    const countForType = existingMachines.filter((m) => m.sessionType === sessionType).length;
    const base = machineNameBases[sessionType] || `${sessionType.toUpperCase()} Unit`;
    const m = await prisma.machine.create({
      data: {
        clinicId: clinic.id,
        name: `${base} #${countForType + 1}`,
        sessionType,
        serialNumber: `${sessionType.toUpperCase()}-${new Date().getFullYear()}-${randInt(1000, 9999)}`,
        status: "active",
        createdAt: BigInt(Date.now()),
      },
    });
    newMachines.push(m);
    console.log(`✓ Machine "${m.name}" (${m.sessionType})`);
  }
  const allMachines = [...existingMachines, ...newMachines];
  function machineFor(sessionType) {
    const candidates = allMachines.filter((m) => m.sessionType === sessionType);
    return candidates.length ? pick(candidates) : null;
  }
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
  const sessionTypesAvailable = sessionTypesInUse.length ? sessionTypesInUse : ["qs", "lhr"];

  console.log("\n=== 2. Package type presets (Settings → Packages) ===");
  const existingPresetNames = new Set(
    (await prisma.packageTypeDef.findMany({ where: { clinicId: clinic.id }, select: { name: true } })).map((p) => p.name)
  );
  const presetDefs = [
    { sessionType: "qs", name: "5-Session Pigmentation Package", totalSessions: 5, suggestedAmount: 8500 },
    { sessionType: "qs", name: "10-Session Tattoo Removal Package", totalSessions: 10, suggestedAmount: 22000 },
    { sessionType: "lhr", name: "6-Session Underarms Package", totalSessions: 6, suggestedAmount: 7200 },
    { sessionType: "lhr", name: "8-Session Full Legs Package", totalSessions: 8, suggestedAmount: 18500 },
    { sessionType: "lhr", name: "10-Session Full Body Package", totalSessions: 10, suggestedAmount: 32000 },
    { sessionType: "hydrafacial", name: "5-Session Glow Package", totalSessions: 5, suggestedAmount: 14000 },
  ].filter((p) => sessionTypesAvailable.includes(p.sessionType) || existingSessionTypes.some((t) => t.key === p.sessionType));
  let presetsCreated = 0;
  for (const def of presetDefs) {
    if (existingPresetNames.has(def.name)) continue; // safe to re-run
    await prisma.packageTypeDef.create({
      data: { clinicId: clinic.id, ...def, createdAt: BigInt(Date.now()) },
    });
    presetsCreated++;
    console.log(`✓ Preset "${def.name}" (${def.totalSessions} sessions, ₹${def.suggestedAmount})`);
  }
  console.log(`✓ Created ${presetsCreated} new package type preset(s)`);

  console.log("\n=== 3. New patients ===");
  const existingPhones = new Set((await prisma.patient.findMany({ where: { clinicId: clinic.id }, select: { phone: true } })).map((p) => p.phone));
  const PATIENT_COUNT = 30;
  const patients = [];
  for (let i = 0; i < PATIENT_COUNT; i++) {
    const gender = pick(["M", "F"]);
    const name = randomName(gender);
    const phone = randomPhone(existingPhones);
    const createdAt = daysAgo(randInt(1, 60));
    const hasContraindication = Math.random() < 0.15;
    const p = await prisma.patient.create({
      data: {
        clinicId: clinic.id,
        name,
        phone,
        phoneNormalized: normalizePhone(phone),
        nameLower: name.toLowerCase(),
        patientCode: generatePatientCode(),
        email: Math.random() < 0.6 ? `${name.split(" ")[0].toLowerCase()}${randInt(1, 99)}@example.com` : null,
        age: randInt(19, 62),
        gender: gender === "F" ? "Female" : "Male",
        address: `${randInt(1, 400)}, ${pick(CITIES_AREAS)}, Mumbai`,
        skinType: pick(["I", "II", "III", "IV", "V", "VI"]),
        contraindications: hasContraindication ? pick(CONTRAINDICATIONS) : null,
        createdAt: BigInt(createdAt),
      },
    });
    patients.push(p);
  }
  console.log(`✓ Created ${patients.length} new patients`);

  console.log("\n=== 4. Packages for some of the new patients ===");
  const packagesByPatient = new Map();
  const packagePatients = patients.slice(0, 12);
  for (const patient of packagePatients) {
    const sessionType = pick(sessionTypesAvailable);
    const totalSessions = pick([5, 8, 10]);
    const perSession = feeFor(sessionType);
    const totalAmount = Math.round(perSession * totalSessions * 0.85);
    const patientAgeDays = Math.max(1, Math.floor((Date.now() - Number(patient.createdAt)) / DAY_MS));
    const purchaseDate = daysAgo(randInt(1, patientAgeDays));
    const pkg = await prisma.package.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        sessionType,
        label: `${totalSessions}-Session ${sessionType === "lhr" ? "Laser Hair Removal" : sessionType === "hydrafacial" ? "HydraFacial" : "Q-Switch"} Package`,
        totalSessions,
        totalAmount,
        purchaseDate: dateStr(purchaseDate),
        paymentMethod: pick(["cash", "online"]),
        createdAt: BigInt(purchaseDate),
      },
    });
    packagesByPatient.set(patient.id, pkg);
  }
  console.log(`✓ Created ${packagesByPatient.size} packages`);

  console.log("\n=== 5. Visits + receipts (real revenue) ===");
  let visitCount = 0;
  let receiptCount = 0;
  for (const patient of patients) {
    const pkg = packagesByPatient.get(patient.id);
    const visitTypes = pkg ? [pkg.sessionType, pkg.sessionType, ...sessionTypesAvailable] : sessionTypesAvailable;
    const numVisits = randInt(1, 6);
    const patientAgeDays = Math.max(1, Math.floor((Date.now() - Number(patient.createdAt)) / DAY_MS));

    let sessionsRedeemed = 0;
    let lastSessionType = pick(sessionTypesAvailable);
    let lastArea = areaFor(lastSessionType);
    let lastFee = feeFor(lastSessionType);
    for (let v = 0; v < numVisits; v++) {
      const sessionType = pick(visitTypes);
      const visitDate = daysAgo(randInt(0, patientAgeDays));
      const usesPackage = pkg && pkg.sessionType === sessionType && sessionsRedeemed < pkg.totalSessions && Math.random() < 0.7;
      const area = areaFor(sessionType);
      const fee = usesPackage ? 0 : feeFor(sessionType);
      lastSessionType = sessionType;
      lastArea = area;
      lastFee = fee;

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
      const followUpDate = Math.random() < 0.3 ? dateStr(visitDate + randInt(21, 45) * DAY_MS) : null;

      const visit = await prisma.visit.create({
        data: {
          clinicId: clinic.id,
          patientId: patient.id,
          sessionType,
          date: dateStr(visitDate),
          fields,
          areas: [{ fields }],
          packageId: usesPackage ? pkg.id : null,
          machineId: machineFor(sessionType)?.id ?? null,
          performedByUid: staffMember.id,
          performedByName: staffMember.name,
          durationMinutes: pick([30, 45, 60]),
          paymentMethod: usesPackage ? null : pick(["cash", "online"]),
          followUpDate,
          followUpNote: followUpDate ? "Check for any reaction, confirm next session" : null,
          createdAt: BigInt(visitDate),
        },
      });
      visitCount++;
      if (usesPackage) sessionsRedeemed++;

      if (!usesPackage && Math.random() < 0.75) {
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
            date: dateStr(visitDate),
            items: [{ description: `${sessionType.toUpperCase()} — ${area} (${dateStr(visitDate)})`, amount: fee, discount: 0 }],
            amount: fee,
            visitId: visit.id,
            issuedByUid: issuer.id,
            issuedByName: issuer.name,
            createdAt: BigInt(visitDate),
          },
        });
        receiptCount++;
      }
    }
  }
  console.log(`✓ Created ${visitCount} visits, ${receiptCount} receipts from visits`);

  let packageReceiptCount = 0;
  for (const [patientId, pkg] of packagesByPatient) {
    const patient = patients.find((p) => p.id === patientId);
    const issuer = pick(staff);
    const receiptNumber = await allocateReceiptNumber(prisma, clinic.id);
    await prisma.receipt.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        patientAge: patient.age,
        patientGender: patient.gender,
        patientAddress: patient.address,
        receiptNumber,
        date: pkg.purchaseDate,
        items: [{ description: `Package: ${pkg.label}`, amount: pkg.totalAmount, discount: 0 }],
        amount: pkg.totalAmount,
        packageId: pkg.id,
        issuedByUid: issuer.id,
        issuedByName: issuer.name,
        createdAt: pkg.createdAt,
      },
    });
    packageReceiptCount++;
  }
  console.log(`✓ Created ${packageReceiptCount} receipts for packages`);

  console.log("\n=== 6. More appointments (past, today, upcoming) ===");
  const existingPatients = await prisma.patient.findMany({ where: { clinicId: clinic.id }, select: { id: true, name: true, phone: true } });
  let apptCount = 0;

  for (let i = 0; i < 20; i++) {
    const patient = pick(existingPatients);
    const sessionType = pick(sessionTypesAvailable);
    const apptDate = daysAgo(randInt(2, 30));
    const status = pickWeighted([
      ["completed", 65],
      ["no-show", 15],
      ["cancelled", 20],
    ]);
    await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        sessionType,
        date: dateStr(apptDate),
        time: randomTime(),
        durationMinutes: pick([30, 45, 60]),
        status,
        createdAt: BigInt(apptDate - DAY_MS),
      },
    });
    apptCount++;
  }

  for (let i = 0; i < 6; i++) {
    const patient = pick(existingPatients);
    const sessionType = pick(sessionTypesAvailable);
    await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        sessionType,
        date: dateStr(Date.now()),
        time: randomTime(),
        durationMinutes: pick([30, 45, 60]),
        status: i < 2 ? "completed" : "booked",
        createdAt: BigInt(daysAgo(2)),
      },
    });
    apptCount++;
  }

  for (let i = 0; i < 18; i++) {
    const patient = pick(existingPatients);
    const sessionType = pick(sessionTypesAvailable);
    await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        sessionType,
        date: dateStr(daysFromNow(randInt(1, 14))),
        time: randomTime(),
        durationMinutes: pick([30, 45, 60]),
        status: "booked",
        createdAt: BigInt(daysAgo(1)),
      },
    });
    apptCount++;
  }

  console.log(`✓ Created ${apptCount} more appointments`);

  const finalCounts = {
    patients: await prisma.patient.count({ where: { clinicId: clinic.id } }),
    visits: await prisma.visit.count({ where: { clinicId: clinic.id } }),
    appointments: await prisma.appointment.count({ where: { clinicId: clinic.id } }),
    packages: await prisma.package.count({ where: { clinicId: clinic.id } }),
    packageTypeDefs: await prisma.packageTypeDef.count({ where: { clinicId: clinic.id } }),
    machines: await prisma.machine.count({ where: { clinicId: clinic.id } }),
    receipts: await prisma.receipt.count({ where: { clinicId: clinic.id } }),
  };
  const revenue = await prisma.receipt.aggregate({ where: { clinicId: clinic.id }, _sum: { amount: true } });

  console.log("\n=== Done ===");
  console.log(`Clinic: ${clinic.name} (${clinic.id})`);
  console.log("New totals:", finalCounts);
  console.log(`Total revenue across all receipts: ₹${Math.round(revenue._sum.amount || 0).toLocaleString("en-IN")}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
