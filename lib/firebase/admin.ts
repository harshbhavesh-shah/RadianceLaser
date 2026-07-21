// Firebase ADMIN SDK — server-only. This has full access bypassing security
// rules, so it must NEVER be imported into a client component or anything
// bundled for the browser. It's used in: API routes, server components, and
// the one-off scripts/ folder.

import "server-only";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Lazily initialized — deliberately NOT created as a top-level const. Next.js
// analyzes API route modules during `next build` ("collecting page data"),
// which would otherwise run this initialization (and require real Firebase
// credentials) at build time instead of request time. Wrapping it in a
// function means it only actually runs the first time a route/component
// calls adminAuth()/adminDb() while handling a real request.
let _adminApp: App | undefined;

function getAdminApp(): App {
  if (_adminApp) return _adminApp;
  if (getApps().length) {
    _adminApp = getApps()[0];
    return _adminApp;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Check FIREBASE_ADMIN_PROJECT_ID, " +
      "FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in .env.local " +
      "(see .env.local.example)."
    );
  }

  _adminApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return _adminApp;
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}
