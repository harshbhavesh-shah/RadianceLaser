# LaserClinic — multi-tenant clinic management SaaS

A multi-clinic SaaS platform for laser/aesthetics clinics: clinics sign in
and land in their own portal, with data isolated per clinic in Firestore.
Covers day-to-day clinic operations end to end — patients, treatment
sessions, appointments, prepaid packages, consent forms, receipts, and
before/after photos — not just the auth/tenancy layer.

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

## One-off migration scripts

- `scripts/backfillPatientSearchFields.mjs` — populates `phoneNormalized` and
  `nameLower` on any patient documents created before those fields existed.
  Only needed once, on a deployment that already had patients before this
  change; new patients get both fields automatically. Safe to re-run.

## Deploying to Vercel

1. Push this repo to GitHub
2. Import it in [Vercel](https://vercel.com/new)
3. Add all the same environment variables from `.env.local` in the Vercel
   project settings (Environment Variables tab) — **except** `SETUP_SECRET`,
   which is only needed for the local bootstrap script
4. Deploy

Every push to your main branch will auto-deploy from then on.

## What's actually here right now

Login, session handling, and tenant isolation, plus the actual clinic
features built on top of them:

- **Patients** — records with skin type, contraindications, duplicate-phone
  detection, and per-patient history
- **Visits** — multi-area treatment session logging (built-in Q-Switch/LHR
  types, plus clinic-defined custom machine types with their own fields),
  linked to appointments and packages where relevant
- **Appointments** — day/week/month calendar views plus a list view, with
  auto-complete once a visit + receipt exist for a booking
- **Packages** — prepaid session bundles with a usage ledger computed live
  from visits (never stored, so it can't drift out of sync)
- **Consent forms** — clinic-authored templates with `{{variable}}`
  substitution, signed with an on-screen signature pad, frozen at signing
  time
- **Receipts** — itemized, with atomically-allocated sequential numbers
  (`lib/receiptNumber.ts`)
- **Patient photos** — before/after galleries with a sensitive-content blur
  toggle
- **Analytics** — revenue and session breakdowns by type/staff/machine
- **Settings** — clinic profile, staff management, machines, consent
  templates, and bulk CSV/Excel import for patients and visit history
- Role-based gating in a handful of pages (`owner` vs `doctor` vs
  `reception`), though not yet consolidated into a single policy layer

## Known limitations / next steps

- **No self-serve signup** — `scripts/createClinic.mjs` is still the only
  way to add a clinic; there's no in-product signup or billing flow yet
- **No billing** — no Stripe integration; nothing meters or charges clinics
- **Photos and signatures are stored as base64 inside Firestore documents**,
  not Firebase Storage, because Storage needs the paid Blaze plan. Works
  fine at small scale (images are compressed client-side to stay well under
  the 1MiB/doc limit — see `lib/imageCompression.ts`), but is worth
  migrating to Storage once clinics are paying, both for cost and to stop
  every patient-record read from dragging image bytes along with it
- **Pagination is partial.** The Patients list and the Documents page's
  Receipts/Consent Forms lists are cursor-paginated (`getPatientsPage`,
  `getClinicReceiptsPage`, `getClinicConsentFormsPage` — "Load more", not
  infinite scroll or numbered pages). The Patients list also has real
  server-side search across the whole roster (name/phone/code *prefix*
  match, not substring — see `searchPatients` in
  `lib/firestore/patients.ts`); the Documents lists' search bars still only
  search whatever page is currently loaded, not the whole clinic, since that
  would need denormalizing a lowercased patient name onto `Receipt`/
  `ConsentForm` the way `Patient.nameLower` already does. Visits, Analytics,
  and Appointments still load a whole clinic's collection in one query —
  fine today, will need the same treatment as clinics accumulate years of
  history
- **No automated tests** — worth adding around the receipt-number counter
  transaction and the package ledger computation first, since bugs there
  turn into billing disputes rather than just UI glitches
- **No audit log** — no record of who viewed/edited what, which matters
  once this holds real patient health data and signed consent forms for
  paying customers
- Role-based UI is ad hoc per-page rather than one shared `can(action,
  role)` policy helper — fine for 3 roles, will get harder to keep
  consistent as it grows
