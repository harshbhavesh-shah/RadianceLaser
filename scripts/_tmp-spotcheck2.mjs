import { config } from "dotenv";
config({ path: ".env.local" });
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();
const clinicId = "RL4ucpU7JPI8Lg22jqeE";
// patientno 601 had no phone in the earlier sample rows (empty patientmobile) - look up by name instead
const snap = await db.collection("patients").where("clinicId", "==", clinicId).get();
const p = snap.docs.find(d => d.data().name && d.data().phone === "0000000000" ).id;
