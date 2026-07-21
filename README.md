# LaserClinic — multi-tenant starter

A basic skeleton for a multi-clinic SaaS platform: clinics sign in and land
in their own portal, with data isolated per clinic in Firestore.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS**
- **Firebase Auth** for login (email/password)
- **Firestore** for data, isolated per clinic via a `clinicId` field +
  security rules
- **Firebase Admin SDK** for server-side auth verification and the
  clinic-creation script

## How the auth/multi-tenancy model works

1. Every staff user is a Firebase Auth user with two **custom claims** baked
   into their auth token: `clinicId` and `role` (`owner` / `doctor` /
   `reception`). These are set server-side only (see
   `scripts/createClinic.mjs`) — a client can never set its own claims.
2. On login, the browser signs in with Firebase Auth directly, then sends
   the resulting ID token to `/api/auth/session`, which verifies it and
   sets a secure `HttpOnly` session cookie. The raw ID token itself is never
   stored in a cookie.
3. `middleware.ts` does a **lightweight check** — is the cookie present at
   all — and redirects to `/login` if not. This runs on the Edge runtime,
   which can't run the Firebase Admin SDK, so it can't fully verify the
   cookie.
4. `app/dashboard/layout.tsx` does the **real check** — `getSession()`
   (in `lib/session.ts`) verifies the cookie signature/expiry via the Admin
   SDK and pulls out `clinicId`/`role`. This runs in the normal Node.js
   runtime, so it can do full verification. This is the actual security
   boundary for pages.
5. Every Firestore document belonging to a clinic (appointments, patients,
   etc.) carries a `clinicId` field. `firestore.rules` enforces that a user
   can only read/write documents whose `clinicId` matches their own token's
   claim — so even a leaked document ID from another clinic is unreadable.

## First-time setup

### 1. Create a Firebase project

In the [Firebase Console](https://console.firebase.google.com):
- Create a new project
- Enable **Authentication** → Email/Password sign-in method
- Enable **Firestore Database** (start in production mode — the rules file
  here handles access control)
- Go to Project Settings → General → add a Web app → copy the config values
- Go to Project Settings → Service Accounts → Generate new private key →
  this downloads a JSON file with the admin credentials

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in the `NEXT_PUBLIC_FIREBASE_*` values from the web app config, and the
`FIREBASE_ADMIN_*` values from the service account JSON file (`project_id`,
`client_email`, `private_key`).

The private key needs to stay wrapped in quotes with its `\n` characters
intact — copy it exactly as it appears in the JSON file.

### 3. Install dependencies

```bash
npm install
```

### 4. Deploy Firestore security rules

Install the Firebase CLI if you don't have it (`npm install -g firebase-tools`),
then:

```bash
firebase login
# edit .firebaserc and put your real project ID in place of the placeholder
firebase deploy --only firestore:rules
```

### 5. Create your first clinic + owner login

There's no self-serve signup yet, so bootstrap the first clinic manually:

```bash
npm run create-clinic -- --clinicName "Advanced Skin Clinic" --email you@example.com --password "some-temp-password" --role owner
```

This creates the clinic document, a Firebase Auth user, and sets that
user's custom claims to tie them to the new clinic. Run it again with
different values any time you want to add another clinic (a future
customer) or another staff member.

### 6. Run it locally

```bash
npm run dev
```

Visit `http://localhost:3000` — it'll redirect to `/login`. Sign in with the
email/password you just created.

## Deploying to Vercel

1. Push this repo to GitHub
2. Import it in [Vercel](https://vercel.com/new)
3. Add all the same environment variables from `.env.local` in the Vercel
   project settings (Environment Variables tab) — **except** `SETUP_SECRET`,
   which is only needed for the local bootstrap script
4. Deploy

Every push to your main branch will auto-deploy from then on.

## What's actually here right now

This is intentionally minimal — just the auth/tenancy skeleton, not the
actual clinic features yet:

- Login page, session handling, protected `/dashboard` route
- A placeholder dashboard page showing the signed-in clinic's name and the
  user's role
- Firestore rules ready for tenant-scoped collections (`appointments`,
  `patients`, `counters` — matching the shape of what the original
  `admin.html`/`create.html` prototype used)

## Next steps (not built yet)

- Rebuild the appointment table, patient view (QS/LHR popups), token
  system, etc. as React components under `app/dashboard/`
- Self-serve clinic signup (right now, `scripts/createClinic.mjs` is the
  only way to add a clinic)
- Role-based UI (e.g. hide certain actions from `reception` vs `owner`)
- Per-clinic configuration (e.g. customizable session-log columns, since
  different clinics will want different fields tracked)
- Billing (Stripe) once you're ready to actually charge clinics
