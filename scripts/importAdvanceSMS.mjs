#!/usr/bin/env node
/**
 * One-time import of the clinic's legacy Access database (AdvanceSMS.mdb)
 * into a live clinic account. Source tables (exported to CSV via mdb-tools
 * beforehand — see README note below): patient_master, Patient_visit_Qswitch
 * (sessionType "qs"), patient_visit_Detail (sessionType "lhr").
 *
 * Decisions made with the clinic owner before writing this:
 *  - Packages (PackageMaster/PackageToPatient) are skipped entirely — the
 *    old system never recorded a purchase date, and packages are a
 *    required-date field here. This means some historical visits whose fee
 *    was covered by a (skipped) package will show a lower/zero fee than
 *    what was actually charged at the time — feesPackage* columns are
 *    intentionally NOT added into the imported fee, since attributing that
 *    money to a direct-pay visit that wasn't one would misrepresent it.
 *  - Patients with no phone on file (~160 of 1095) get a placeholder phone
 *    ("0000000000") rather than being skipped, so their visit history still
 *    comes in.
 *  - The old system's second treatment table tracks Area/kJ/Power/Stack,
 *    which doesn't match the app's built-in LHR columns (Area/HR/SHR/
 *    Stack) — kept the app's columns as-is per the owner's call, importing
 *    kJ→hr and Power→shr as literal raw text (e.g. "22/1", "9/9:8/8"),
 *    unparsed — never split, never coerced to a number. The rolled-up
 *    `fields.hr`/`fields.shr` summary (which sums as numbers, same as the
 *    app's own rollupAreaFields) will often show 0 for these because of
 *    that — the real value is preserved on the area entry, not lost.
 *
 * Usage:
 *   node scripts/importAdvanceSMS.mjs --dir /tmp/advancesms_export --dry-run
 *   node scripts/importAdvanceSMS.mjs --dir /tmp/advancesms_export
 *
 * Requires .env.local filled in with FIREBASE_ADMIN_* values, and the three
 * CSVs (patient_master.csv, qswitch.csv, detail.csv) already exported from
 * the .mdb via mdb-tools (`brew install mdbtools`):
 *   mdb-export AdvanceSMS.mdb patient_master > patient_master.csv
 *   mdb-export AdvanceSMS.mdb Patient_visit_Qswitch > qswitch.csv
 *   mdb-export AdvanceSMS.mdb patient_visit_Detail > detail.csv
 */

import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "csv-parse/sync";
import { config } from "dotenv";
config({ path: ".env.local" });
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const CLINIC_ID = "RL4ucpU7JPI8Lg22jqeE"; // Advanced Skin Clinic — the only clinic on the platform
const PATIENT_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // mirrors lib/firestore/patients.ts
const PLACEHOLDER_PHONE = "0000000000";
const BATCH_CHUNK_SIZE = 400;

// Mirrors lib/sessionTypes.ts BUILT_IN_SESSION_TYPE_CONFIG — kept local
// since this is a plain Node script, not compiled through the Next app's
// TypeScript/path-alias setup.
const QS_COLUMNS = [
  { key: "area", type: "text" },
  { key: "carbon", type: "select" },
  { key: "mode", type: "text" },
  { key: "hp", type: "text" },
  { key: "eng", type: "number" },
  { key: "pass", type: "number" },
  { key: "repeat", type: "number" },
  { key: "fee", type: "number" },
];
const LHR_COLUMNS = [
  { key: "area", type: "text" },
  { key: "hr", type: "number" },
  { key: "shr", type: "number" },
  { key: "stack", type: "number" },
  { key: "fee", type: "number" },
];

function parseArgs() {
  const args = { dryRun: false, dir: "." };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--dir") args.dir = argv[++i];
  }
  return args;
}

function readCsv(path) {
  const raw = readFileSync(path, "utf-8");
  return parse(raw, { columns: true, skip_empty_lines: true });
}

function normalizePhone(phone) {
  return phone.replace(/\D/g, "");
}

function generatePatientCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += PATIENT_CODE_CHARS.charAt(Math.floor(Math.random() * PATIENT_CODE_CHARS.length));
  }
  return `PT-${code}`;
}

/** Access exports dates as "MM/DD/YY HH:MM:SS" (confirmed against the real
 * data — the first component never exceeds 12). Returns "YYYY-MM-DD", or
 * null if blank/unparseable. Two-digit years are all in the 2000s here
 * (source data spans 2018–2022). */
function parseAccessDate(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})/);
  if (!match) return null;
  const [, mm, dd, yy] = match;
  const year = 2000 + Number(yy);
  return `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function dateToMs(dateStr) {
  if (!dateStr) return null;
  const ms = new Date(`${dateStr}T00:00:00`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function normalizeCarbon(raw) {
  const v = (raw || "").trim().toLowerCase();
  if (v === "yes") return "Yes";
  if (v === "no") return "No";
  return raw?.trim() || undefined;
}

function rollupAreaFields(areaFieldsList, columns) {
  const rollup = {};
  for (const col of columns) {
    const values = areaFieldsList
      .map((f) => f[col.key])
      .filter((v) => v !== undefined && v !== null && v !== "");
    if (values.length === 0) continue;
    if (col.type === "number") {
      rollup[col.key] = values.reduce((sum, v) => sum + (Number(v) || 0), 0);
    } else {
      rollup[col.key] = Array.from(new Set(values.map(String))).join(", ");
    }
  }
  return rollup;
}

function buildQsAreas(row) {
  const areas = [];
  for (let i = 1; i <= 6; i++) {
    const area = (row[`bodypart${i}`] || "").trim();
    const fee = Number(row[`fees${i}`]) || 0;
    if (!area && !fee) continue;
    const fields = {};
    if (area) fields.area = area;
    const carbon = normalizeCarbon(row[`Carban${i}`]);
    if (carbon) fields.carbon = carbon;
    const mode = (row[`Mode${i}`] || "").trim();
    if (mode) fields.mode = mode;
    const hp = (row[`Hp${i}`] || "").trim();
    if (hp) fields.hp = hp;
    const eng = (row[`Eng${i}`] || "").trim();
    if (eng) fields.eng = Number(eng) || 0;
    const pass = (row[`Pass${i}`] || "").trim();
    if (pass) fields.pass = Number(pass) || 0;
    const repeat = (row[`Repet${i}`] || "").trim();
    if (repeat) fields.repeat = Number(repeat) || 0;
    fields.fee = fee;
    areas.push({ fields });
  }
  return areas;
}

function buildLhrAreas(row) {
  const areas = [];
  for (const suffix of ["11", "12", "21", "22", "31", "32"]) {
    const area = (row[`bodypart${suffix}`] || "").trim();
    const fee = Number(row[`fees${suffix}`]) || 0;
    if (!area && !fee) continue;
    const fields = {};
    if (area) fields.area = area;
    // kJ/Power imported as literal raw text, unparsed — see file header.
    const kj = (row[`kj${suffix}`] || "").trim();
    if (kj) fields.hr = kj;
    const power = (row[`power${suffix}`] || "").trim();
    if (power) fields.shr = power;
    const stack = (row[`stack${suffix}`] || "").trim();
    if (stack) fields.stack = stack;
    fields.fee = fee;
    areas.push({ fields });
  }
  return areas;
}

async function main() {
  const { dryRun, dir } = parseArgs();

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing FIREBASE_ADMIN_* values in .env.local");
    process.exit(1);
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const db = getFirestore();

  console.log(`Reading CSVs from ${dir} ...`);
  const patientRows = readCsv(join(dir, "patient_master.csv"));
  const qsRows = readCsv(join(dir, "qswitch.csv"));
  const lhrRows = readCsv(join(dir, "detail.csv"));
  console.log(`  patients: ${patientRows.length}, qs visits: ${qsRows.length}, lhr visits: ${lhrRows.length}`);

  // Earliest visit date per legacy patientno, used as a createdAt fallback
  // for patients whose entrydate is blank (most of them).
  const earliestVisitDateByPatientno = new Map();
  for (const row of [...qsRows, ...lhrRows]) {
    const d = parseAccessDate(row.user_last_visit_date);
    if (!d) continue;
    const existing = earliestVisitDateByPatientno.get(row.patientno);
    if (!existing || d < existing) earliestVisitDateByPatientno.set(row.patientno, d);
  }

  // ---- Build patient docs ----
  let placeholderPhoneCount = 0;
  const patientDocs = []; // { ref, data, patientno }
  const patientsCollection = db.collection("patients");

  for (const row of patientRows) {
    const name = (row.patientname || "").trim();
    if (!name) continue; // no usable record without a name

    const phoneRaw = (row.patientmobile || "").trim();
    const phone = phoneRaw || PLACEHOLDER_PHONE;
    if (!phoneRaw) placeholderPhoneCount++;

    const address = [row.add1, row.add2, row.add3, row.city]
      .map((s) => (s || "").trim())
      .filter(Boolean)
      .join(", ");

    const ageNum = Number(row.age);
    const entryDate = parseAccessDate(row.entrydate);
    const createdAt =
      dateToMs(entryDate) ?? dateToMs(earliestVisitDateByPatientno.get(row.patientno)) ?? Date.now();

    const data = {
      clinicId: CLINIC_ID,
      name,
      phone,
      phoneNormalized: normalizePhone(phone),
      nameLower: name.toLowerCase(),
      patientCode: generatePatientCode(),
      legacyPatientNo: Number(row.patientno),
      createdAt,
      ...(address ? { address } : {}),
      ...(Number.isFinite(ageNum) && ageNum > 0 ? { age: Math.round(ageNum) } : {}),
    };

    patientDocs.push({ ref: patientsCollection.doc(), data, patientno: row.patientno });
  }

  console.log(`Prepared ${patientDocs.length} patient docs (${placeholderPhoneCount} with placeholder phone).`);

  const patientIdByPatientno = new Map(patientDocs.map((p) => [p.patientno, p.ref.id]));

  // ---- Build visit docs ----
  let orphanVisits = 0;
  const visitDocs = [];
  const visitsCollection = db.collection("visits");

  function buildVisit(row, sessionType, areas) {
    const patientId = patientIdByPatientno.get(row.patientno);
    if (!patientId) {
      orphanVisits++;
      return null;
    }
    const date = parseAccessDate(row.user_last_visit_date) || "";
    const followUpDate = parseAccessDate(row.user_next_date);
    const remark = (row.remark || "").trim();
    const columns = sessionType === "qs" ? QS_COLUMNS : LHR_COLUMNS;
    const fields = rollupAreaFields(
      areas.map((a) => a.fields),
      columns
    );
    const createdAt = dateToMs(date) ?? Date.now();

    return {
      clinicId: CLINIC_ID,
      patientId,
      sessionType,
      date,
      fields,
      areas,
      legacyVisitNo: Number(row.xauto),
      ...(followUpDate ? { followUpDate } : {}),
      ...(followUpDate && remark ? { followUpNote: remark } : {}),
      createdAt,
    };
  }

  for (const row of qsRows) {
    const areas = buildQsAreas(row);
    if (areas.length === 0) continue;
    const data = buildVisit(row, "qs", areas);
    if (data) visitDocs.push({ ref: visitsCollection.doc(), data });
  }
  for (const row of lhrRows) {
    const areas = buildLhrAreas(row);
    if (areas.length === 0) continue;
    const data = buildVisit(row, "lhr", areas);
    if (data) visitDocs.push({ ref: visitsCollection.doc(), data });
  }

  console.log(`Prepared ${visitDocs.length} visit docs (${orphanVisits} skipped — no matching patient).`);

  if (dryRun) {
    console.log("\nDry run — nothing written. Sample patient:");
    console.log(JSON.stringify(patientDocs[0]?.data, null, 2));
    console.log("\nSample qs visit:");
    console.log(JSON.stringify(visitDocs.find((v) => v.data.sessionType === "qs")?.data, null, 2));
    console.log("\nSample lhr visit:");
    console.log(JSON.stringify(visitDocs.find((v) => v.data.sessionType === "lhr")?.data, null, 2));
    return;
  }

  console.log("\nWriting patients...");
  for (let i = 0; i < patientDocs.length; i += BATCH_CHUNK_SIZE) {
    const batch = db.batch();
    for (const { ref, data } of patientDocs.slice(i, i + BATCH_CHUNK_SIZE)) batch.set(ref, data);
    await batch.commit();
    console.log(`  ${Math.min(i + BATCH_CHUNK_SIZE, patientDocs.length)}/${patientDocs.length}`);
  }

  console.log("Writing visits...");
  for (let i = 0; i < visitDocs.length; i += BATCH_CHUNK_SIZE) {
    const batch = db.batch();
    for (const { ref, data } of visitDocs.slice(i, i + BATCH_CHUNK_SIZE)) batch.set(ref, data);
    await batch.commit();
    console.log(`  ${Math.min(i + BATCH_CHUNK_SIZE, visitDocs.length)}/${visitDocs.length}`);
  }

  console.log(
    `\nDone. Imported ${patientDocs.length} patients and ${visitDocs.length} visits into clinic ${CLINIC_ID}.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
