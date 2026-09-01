#!/usr/bin/env node
/**
 * Creates (or re-seeds) a persistent demo clinic — "Lumière Aesthétique" —
 * fully populated with realistic fake data: staff (with real Firebase Auth
 * logins), machines, a custom treatment type, patients, visits, packages,
 * receipts, and a mix of past/today/upcoming appointments (including a
 * couple of still-unlinked "public booking" ones, to demo that flow too).
 * Unlike a quick manual test clinic, this one is meant to be kept around
 * as a standing demo account — safe to re-run: it always creates a fresh
 * clinic (a new id each time) rather than upserting into an existing one,
 * so re-running this is only for regenerating the demo from scratch, not
 * for topping up an existing one.
 *
 * Usage:
 *   node scripts/seedDemoClinic.mjs
 *
 * Requires .env.local to be filled in with FIREBASE_ADMIN_* and
 * DATABASE_URL values. Prints staff login credentials at the end — save
 * them, they're not stored anywhere afterward (passwords are hashed by
 * Firebase Auth, same as any real account).
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
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
const DEMO_PASSWORD = "LumiereDemo2026!";

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickWeighted(pairs) {
  // pairs: [[value, weight], ...]
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

// --- Fake data pools -------------------------------------------------

const FIRST_NAMES_F = [
  "Ananya", "Priya", "Kavya", "Ishita", "Riya", "Sneha", "Meera", "Divya",
  "Pooja", "Neha", "Aditi", "Kritika", "Sanya", "Tanvi", "Simran", "Anjali",
  "Nisha", "Ritika", "Shreya", "Kajal",
];
const FIRST_NAMES_M = [
  "Arjun", "Rohan", "Aditya", "Vikram", "Karan", "Rahul", "Aryan", "Siddharth",
  "Nikhil", "Varun", "Ishaan", "Dev", "Kabir", "Ayaan", "Vivaan", "Reyansh",
  "Manav", "Yash", "Aarav", "Raghav",
];
const LAST_NAMES = [
  "Sharma", "Verma", "Kapoor", "Malhotra", "Nair", "Iyer", "Reddy", "Mehta",
  "Gupta", "Shah", "Joshi", "Chatterjee", "Bose", "Menon", "Pillai", "Rao",
  "Agarwal", "Bhatia", "Chopra", "Desai",
];
const CITIES_AREAS = ["Bandra", "Andheri", "Powai", "Juhu", "Malad", "Thane", "Vashi", "Borivali"];
const CONTRAINDICATIONS = [
  "Pregnant — avoid retinoids and laser treatments this trimester",
  "On isotretinoin — laser sessions on hold until course completed",
  "Allergic to lidocaine — use alternative topical anesthetic",
  "History of keloid scarring — patch test before any resurfacing",
  "On blood thinners — advise on bruising risk before injectables",
];
const LHR_AREAS = ["Upper Lip", "Chin", "Underarms", "Full Face", "Full Arms", "Full Legs", "Bikini Line", "Back"];
const QS_AREAS = ["Full Face", "Pigmentation Spot", "Tattoo Removal — Forearm", "Under Eye", "Neck"];
const HYDRAFACIAL_AREAS = ["Full Face", "Face & Neck"];

function randomName(gender) {
  const first = gender === "F" ? pick(FIRST_NAMES_F) : pick(FIRST_NAMES_M);
  return `${first} ${pick(LAST_NAMES)}`;
}
function randomPhone() {
  return `9${randInt(0, 9)}${randInt(0, 9)}${randInt(0, 9)}${randInt(0, 9)}${randInt(0, 9)}${randInt(0, 9)}${randInt(0, 9)}${randInt(0, 9)}${randInt(0, 9)}`;
}

async function main() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing FIREBASE_ADMIN_* values in .env.local");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL in .env.local");
    process.exit(1);
  }

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const auth = getAuth();
  const prisma = createPrismaClient();

  console.log("=== 1. Creating clinic ===");
  const clinic = await prisma.clinic.create({
    data: {
      name: "Lumière Aesthétique",
      address: "14 Linking Road, Bandra West, Mumbai 400050",
      subscriptionStatus: "active",
      trialEndsAt: daysAgo(60), // long past — this account is "active", not trialing
      subscriptionRenewsAt: daysFromNow(365),
      createdAt: daysAgo(90),
    },
  });
  console.log(`✓ Clinic "${clinic.name}" (id: ${clinic.id})`);

  console.log("\n=== 2. Creating staff (real Firebase Auth logins) ===");
  const staffDefs = [
    { name: "Dr. Meera Kapoor", email: "owner@lumiere-aesthetique.test", role: "owner" },
    { name: "Dr. Arjun Malhotra", email: "arjun.malhotra@lumiere-aesthetique.test", role: "doctor" },
    { name: "Dr. Sanya Verma", email: "sanya.verma@lumiere-aesthetique.test", role: "doctor" },
    { name: "Priya Nair", email: "priya.nair@lumiere-aesthetique.test", role: "reception" },
  ];
  const staff = [];
  for (const def of staffDefs) {
    const userRecord = await auth.createUser({ email: def.email, password: DEMO_PASSWORD, displayName: def.name });
    await auth.setCustomUserClaims(userRecord.uid, { clinicId: clinic.id, role: def.role });
    await prisma.staffMember.create({
      data: {
        id: userRecord.uid,
        clinicId: clinic.id,
        name: def.name,
        email: def.email,
        role: def.role,
        createdAt: BigInt(daysAgo(85)),
      },
    });
    staff.push({ uid: userRecord.uid, name: def.name, role: def.role });
    console.log(`✓ ${def.role.padEnd(9)} ${def.name} <${def.email}>`);
  }
  const doctors = staff.filter((s) => s.role !== "reception");

  console.log("\n=== 3. Machines + custom treatment type ===");
  const customSessionType = await prisma.sessionTypeDef.create({
    data: {
      clinicId: clinic.id,
      key: "hydrafacial",
      label: "HydraFacial",
      badgeText: "HF",
      badgeClassName: "bg-teal-700 text-white",
      chartColor: "#0F766E",
      columns: [
        { key: "area", label: "Area", type: "text" },
        { key: "intensity", label: "Intensity", type: "select", options: ["Low", "Medium", "High"] },
        { key: "fee", label: "Fee", type: "number" },
      ],
      createdAt: BigInt(daysAgo(85)),
    },
  });
  console.log(`✓ Custom treatment type "${customSessionType.label}" (key: ${customSessionType.key})`);

  const machineDefs = [
    { name: "Q-Switch Nd:YAG #1", sessionType: "qs", serialNumber: "QSW-2024-0113" },
    { name: "Soprano Ice Platinum #1", sessionType: "lhr", serialNumber: "SIP-2023-0847" },
    { name: "HydraFacial MD #1", sessionType: "hydrafacial", serialNumber: "HFM-2024-0056" },
  ];
  const machines = [];
  for (const def of machineDefs) {
    const m = await prisma.machine.create({
      data: {
        clinicId: clinic.id,
        name: def.name,
        sessionType: def.sessionType,
        serialNumber: def.serialNumber,
        status: "active",
        createdAt: BigInt(daysAgo(85)),
      },
    });
    machines.push(m);
    console.log(`✓ Machine "${m.name}" (${m.sessionType})`);
  }
  function machineFor(sessionType) {
    return machines.find((m) => m.sessionType === sessionType);
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

  console.log("\n=== 4. Patients ===");
  const PATIENT_COUNT = 28;
  const patients = [];
  for (let i = 0; i < PATIENT_COUNT; i++) {
    const gender = pick(["M", "F"]);
    const name = randomName(gender);
    const phone = randomPhone();
    const createdAt = daysAgo(randInt(5, 120));
    const hasContraindication = Math.random() < 0.18;
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
  console.log(`✓ Created ${patients.length} patients`);

  console.log("\n=== 5. Packages ===");
  const packagesByPatient = new Map();
  const packagePatients = patients.slice(0, 10);
  for (const patient of packagePatients) {
    const sessionType = pick(["qs", "lhr"]);
    const totalSessions = pick([5, 8, 10]);
    const perSession = feeFor(sessionType);
    const totalAmount = Math.round(perSession * totalSessions * 0.85); // package discount
    const patientAgeDaysForPkg = Math.max(1, Math.floor((Date.now() - Number(patient.createdAt)) / DAY_MS));
    const purchaseDate = daysAgo(randInt(1, patientAgeDaysForPkg));
    const pkg = await prisma.package.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        sessionType,
        label: `${totalSessions}-Session ${sessionType === "lhr" ? "Laser Hair Removal" : "Q-Switch"} Package`,
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

  console.log("\n=== 6. Visits (+ receipts for most) ===");
  let visitCount = 0;
  let receiptCount = 0;
  for (const patient of patients) {
    const pkg = packagesByPatient.get(patient.id);
    const visitTypes = pkg ? [pkg.sessionType, pkg.sessionType, "hydrafacial"] : ["qs", "lhr", "hydrafacial"];
    const numVisits = randInt(1, 5);
    const patientAgeMs = Date.now() - Number(patient.createdAt);
    const patientAgeDays = Math.max(1, Math.floor(patientAgeMs / DAY_MS));

    let sessionsRedeemed = 0;
    for (let v = 0; v < numVisits; v++) {
      const sessionType = pick(visitTypes);
      const visitDate = daysAgo(randInt(0, patientAgeDays));
      const usesPackage = pkg && pkg.sessionType === sessionType && sessionsRedeemed < pkg.totalSessions && Math.random() < 0.7;
      const area = areaFor(sessionType);
      const fee = usesPackage ? 0 : feeFor(sessionType);

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

      const staffMember = pick(doctors);
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
          performedByUid: staffMember.uid,
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

      // Receipt for most non-package visits — matches the real app's usage
      // pattern (package purchases are their own revenue event, so a
      // package-covered visit doesn't get a second receipt).
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
            issuedByUid: issuer.uid,
            issuedByName: issuer.name,
            createdAt: BigInt(visitDate),
          },
        });
        receiptCount++;
      }
    }
  }
  console.log(`✓ Created ${visitCount} visits, ${receiptCount} receipts from visits`);

  // Receipts for package purchases themselves.
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
        issuedByUid: issuer.uid,
        issuedByName: issuer.name,
        createdAt: pkg.createdAt,
      },
    });
    packageReceiptCount++;
  }
  console.log(`✓ Created ${packageReceiptCount} receipts for packages`);

  console.log("\n=== 7. Appointments (past, today, upcoming) ===");
  let apptCount = 0;

  // Past 6 weeks — mostly completed, some no-show/cancelled.
  for (let i = 0; i < 26; i++) {
    const patient = pick(patients);
    const sessionType = pick(["qs", "lhr", "hydrafacial"]);
    const apptDate = daysAgo(randInt(2, 42));
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
        createdAt: BigInt(apptDate - DAY_MS), // booked a day before
      },
    });
    apptCount++;
  }

  // Today — a realistic day's schedule.
  for (let i = 0; i < 5; i++) {
    const patient = pick(patients);
    const sessionType = pick(["qs", "lhr", "hydrafacial"]);
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

  // Upcoming 10 days.
  for (let i = 0; i < 16; i++) {
    const patient = pick(patients);
    const sessionType = pick(["qs", "lhr", "hydrafacial"]);
    await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        sessionType,
        date: dateStr(daysFromNow(randInt(1, 10))),
        time: randomTime(),
        durationMinutes: pick([30, 45, 60]),
        status: "booked",
        createdAt: BigInt(daysAgo(1)),
      },
    });
    apptCount++;
  }

  // A couple of still-unlinked "public booking" appointments, to demo
  // UnlinkedBookingPanel — matches what app/api/public/appointments/route.ts
  // actually creates (patientId left null).
  const unlinkedNames = ["Tanya Oberoi", "Farhan Sheikh"];
  for (const name of unlinkedNames) {
    await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: null,
        patientName: name,
        patientPhone: randomPhone(),
        sessionType: "lhr",
        date: dateStr(daysFromNow(randInt(2, 8))),
        time: randomTime(),
        durationMinutes: 60,
        status: "booked",
        createdAt: BigInt(daysAgo(randInt(0, 2))),
      },
    });
    apptCount++;
  }

  console.log(`✓ Created ${apptCount} appointments (${unlinkedNames.length} still unlinked, for the demo)`);

  console.log("\n=== Done ===");
  console.log(`Clinic: ${clinic.name} (${clinic.id})`);
  console.log("\nStaff logins (all use the same password):");
  for (const def of staffDefs) console.log(`  ${def.role.padEnd(9)} ${def.email}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log("\nSign in at /login with the owner account above.");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
