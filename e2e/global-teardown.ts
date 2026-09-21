import { readFileSync, existsSync } from "fs";
import path from "path";
import { deleteTestClinic, type TestClinic } from "./testClinic";

export default async function globalTeardown() {
  const clinicFile = path.join(__dirname, ".auth", "clinic.json");
  if (!existsSync(clinicFile)) return; // global-setup never got far enough to write it

  const clinic: TestClinic = JSON.parse(readFileSync(clinicFile, "utf-8"));
  await deleteTestClinic(clinic.clinicId);
}
