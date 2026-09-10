import { config } from "dotenv";
config({ path: ".env.local" });
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

const uid = "G2p1Bax4yKTnYLCo47L2JGXQZri2";
const customToken = await getAuth().createCustomToken(uid);

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token: customToken, returnSecureToken: true }),
});
const data = await res.json();
console.log(JSON.stringify({ idToken: data.idToken }));
