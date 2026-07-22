// Firebase CLIENT SDK — used in the browser (login page, client components).
// Never import this into server-only code; use lib/firebase/admin.ts there instead.
//
// NOTE: no Firebase Storage export here — this project runs on the free
// Spark plan, which doesn't include Storage (that requires the paid Blaze
// plan). Photos and signatures are instead embedded as compressed base64
// data URLs directly in Firestore documents — see lib/imageCompression.ts
// and PatientPhoto/ConsentForm in types/index.ts.

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Next.js hot-reloads modules in dev, which can re-run this file and try to
// initialize Firebase twice. getApps()/getApp() guards against that.
function getClientApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export const app: FirebaseApp = getClientApp();
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
