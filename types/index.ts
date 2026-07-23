// Every clinic's data documents (appointments, patients, etc.) should carry
// a clinicId field, matching this shape. Firestore security rules enforce
// that a user can only read/write documents where clinicId matches their
// own auth token's clinicId claim — see firestore.rules.
export interface TenantScoped {
  clinicId: string;
}

export type StatsWindow = "today" | "week" | "month";

// Every clinic (tenant) that signs up for the product.
// Firestore path: clinics/{clinicId}
export interface Clinic {
  id: string;
  name: string;
  createdAt: number; // ms epoch
  address?: string; // shown on printed documents (receipts) — see Settings > Clinic Profile
  // Per-clinic preferences, editable from Settings — see app/dashboard/settings.
  statsWindow?: StatsWindow; // defaults to "today" if unset
}

// Roles a staff member can have within their clinic. Extend this as the
// product grows (e.g. "doctor" vs "reception" vs "owner" already maps onto
// the role distinctions the original admin.html had).
export type UserRole = "owner" | "doctor" | "reception";

// The decoded, verified session — what you get back after checking the
// session cookie server-side. `clinicId` and `role` come from Firebase Auth
// custom claims (see lib/session.ts), not from Firestore, so they're
// available without an extra database read on every request.
//
// NOTE: this is the *auth* session (is someone logged in, and as whom) —
// not to be confused with a logged treatment visit, which is `Visit` below.
export interface Session {
  uid: string;
  email: string | null;
  clinicId: string;
  role: UserRole;
}

// Fitzpatrick skin type — standard classification used to guide laser
// energy/power settings. Folded into the base patient record from day one
// rather than retrofitted later, since it's a safety-relevant field.
export type SkinType = "I" | "II" | "III" | "IV" | "V" | "VI";

export interface Patient extends TenantScoped {
  id: string;
  name: string;
  phone: string;
  email?: string;
  age?: number;
  gender?: string;
  address?: string;
  patientCode: string; // human-friendly ID shown in the UI, e.g. "PT-4K7QX2"
  skinType?: SkinType;
  contraindications?: string; // free text: pregnancy, isotretinoin, photosensitizing meds, etc.
  createdAt: number;
}

// The kinds of treatment visits a patient can have logged against them.
// "qs" and "lhr" are the two built-in types every clinic starts with; a
// clinic can also define its own major machine types (e.g. "co2" for a CO2
// laser) from Settings — those live in Firestore as SessionTypeDef docs
// (see below) and get merged in alongside the built-ins at runtime. Kept as
// a plain string (rather than a strict union) so clinic-defined keys type-check
// everywhere a built-in one would. See lib/sessionTypes.ts for the column
// definitions that drive both the table UI and validation.
export type SessionType = string;

// One treated area within a session — e.g. "Chin" with its own HP/Eng/Pass/
// Repeat/Fee, distinct from "Upper Lips" with different values for the same
// columns, both logged under one Visit. Uses the same column keys as the
// session type's own SessionColumnDef[] (see lib/sessionTypes.ts), including
// its own "area" and "fee" entries — there's nothing area-specific baked
// into the shape itself, it's just one full copy of that type's fields.
export interface VisitAreaEntry {
  fields: Record<string, string | number>;
}

// A single logged visit/session. Deliberately named `Visit` rather than
// "Session" to avoid colliding with the auth `Session` type above.
export interface Visit extends TenantScoped {
  id: string;
  patientId: string;
  sessionType: SessionType;
  date: string; // YYYY-MM-DD, empty string until a date is actually set
  // A visit can cover multiple treated areas in one sitting (e.g. Chin +
  // Upper Lips in the same session, each with its own parameters) — see
  // `areas` below. `fields` always stays populated as a computed rollup of
  // whatever's in `areas` (area names joined, fee summed, other values
  // combined) — see lib/visitAreas.ts — so every existing reader of
  // `visit.fields` (receipts, analytics, photo gallery, package ledger,
  // consent forms) keeps working without change, even for multi-area
  // visits. Visits logged before this feature existed have `fields` set and
  // no `areas` at all, which is equivalent to a single-area visit.
  fields: Record<string, string | number>;
  // Present once a visit has gone through the multi-area form at least
  // once (including a single area — the form always writes this now).
  // Absent on visits logged before this feature, which only ever have
  // `fields`.
  areas?: VisitAreaEntry[];
  // Set when this visit fulfills a booked Appointment — lets "Log Visit"
  // deep-link straight into the right form from Schedule/Today, and lets
  // the appointment auto-complete once both a Visit and a Receipt exist for
  // it (see lib/pipeline.ts). Visits logged without going through an
  // appointment (walk-ins, backdated entries) simply omit this.
  appointmentId?: string;
  // Set when this visit is a redemption against a Package rather than a
  // pay-per-visit session. When set, fields.fee should be 0 — the money was
  // already counted as revenue when the package was purchased, so charging
  // again here would double-count it. See lib/analytics.ts.
  packageId?: string;
  // Attribution fields, all optional — added for the Analytics page's
  // staff/machine breakdown. Existing visits logged before this feature
  // won't have these, so that section of Analytics only reflects visits
  // logged from here on out, not retroactively.
  machineId?: string;
  performedByUid?: string;
  performedByName?: string; // denormalized, same reasoning as patientName on Appointment
  durationMinutes?: number;
  createdAt: number;
}

export type SessionFieldType = "text" | "number" | "select";

export interface SessionColumnDef {
  key: string;
  label: string;
  type: SessionFieldType;
  options?: string[]; // for type: "select"
}

// A prepaid bundle of sessions a patient buys upfront at a discounted
// per-session rate. Usage (the "ledger") is deliberately NOT stored here —
// it's computed by querying Visits where visit.packageId === this package's
// id, so the ledger can never drift out of sync with what actually
// happened. See lib/firestore/packages.ts for that computation.
export interface Package extends TenantScoped {
  id: string;
  patientId: string;
  sessionType: SessionType;
  label: string; // e.g. "10-Session Underarms Package"
  totalSessions: number;
  totalAmount: number;
  purchaseDate: string; // YYYY-MM-DD
  expiryDate?: string; // YYYY-MM-DD, optional
  createdAt: number;
}

// Derived, not stored — see computePackageStatus in lib/firestore/packages.ts.
export type PackageStatus = "active" | "completed" | "expired";

export type AppointmentStatus = "booked" | "completed" | "cancelled" | "no-show";

export interface Appointment extends TenantScoped {
  id: string;
  patientId: string;
  // Denormalized from the Patient record at booking time — same pattern as
  // Visit — so rendering the calendar/list never needs an extra join per
  // appointment. If a patient's name changes later, past appointments keep
  // showing what it was at the time, which is usually what you want anyway.
  patientName: string;
  patientPhone: string;
  sessionType: SessionType;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM, 24-hour
  durationMinutes: number;
  status: AppointmentStatus;
  notes?: string;
  createdAt: number;
}

// A Firestore *mirror* of a Firebase Auth user, kept in sync by the settings
// server actions (lib/firestore/staff.ts). Firebase Auth itself is the
// source of truth for login/claims — Auth doesn't support querying "all
// users in clinic X" efficiently at any scale, since it's a project-wide
// user pool, not scoped per tenant. This mirror is what makes "show me my
// clinic's staff list" a normal, cheap Firestore query instead of scanning
// every user in the whole product.
export interface StaffMember extends TenantScoped {
  id: string; // same as the Firebase Auth uid
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: number;
}

export type MachineStatus = "active" | "maintenance" | "retired";

export interface Machine extends TenantScoped {
  id: string;
  name: string; // e.g. "Q-Switch Nd:YAG #1"
  sessionType: SessionType; // which treatment this machine is used for
  serialNumber?: string;
  purchaseDate?: string; // YYYY-MM-DD
  status: MachineStatus;
  notes?: string;
  createdAt: number;
}

// A clinic-defined *major* machine type — e.g. "CO2 Laser" — distinct from
// adding another Machine (a physical unit) under an existing type like
// Q-Switch. Creating one of these is what makes a brand-new treatment
// category show up as its own tab on the patient page, with its own set of
// session data-entry fields, alongside the built-in Q-Switch/LHR types.
// Firestore path: sessionTypeDefs/{id}
export interface SessionTypeDef extends TenantScoped {
  id: string;
  key: string; // slug used as the SessionType value, e.g. "co2". Unique per clinic.
  label: string; // e.g. "CO2 Laser"
  badgeText: string; // short chip text, e.g. "CO2"
  badgeClassName: string; // Tailwind classes for the badge chip
  chartColor: string; // hex color used in revenue-by-type charts
  columns: SessionColumnDef[]; // session data-entry fields for this type
  createdAt: number;
}

// A single before/after (or progress) photo on a patient's record. Usually
// tied to the specific Visit it was taken at (so it naturally inherits that
// session's date/type/area), but visitId is optional — a photo can also be
// logged standalone (e.g. an initial-consult photo before any session has
// been entered yet).
//
// Image bytes are embedded directly as a base64 data URL rather than stored
// in Firebase Storage — this project runs on the free Spark plan, which
// doesn't include Storage (that needs the paid Blaze plan). Photos are
// resized/compressed client-side (see lib/imageCompression.ts) to stay
// comfortably under Firestore's 1MiB-per-document limit before being saved.
// Firestore path: patientPhotos/{id}
export interface PatientPhoto extends TenantScoped {
  id: string;
  patientId: string;
  visitId?: string; // the Visit this photo documents, if any
  sessionType?: SessionType; // denormalized from the visit, for filtering without a join
  area?: string; // denormalized from the visit's Area field, if set
  date?: string; // YYYY-MM-DD, denormalized from the visit's date, if any
  dataUrl: string; // base64 data: URL — the image itself, resized/compressed client-side
  label?: string; // free text tag, e.g. "Before", "After", "Front", "Side"
  sensitive: boolean; // blurred by default in the gallery grid until revealed
  uploadedByUid: string;
  uploadedByName: string;
  createdAt: number;
}

// A clinic-authored consent form template. `body` is free text with
// {{variable}} placeholders (patientName, clinicName, date, treatmentType,
// area — see lib/consentForms.ts) substituted in when a patient signs it.
// Optionally scoped to a session type (e.g. a CO2-laser-specific consent);
// leave sessionType unset for a general-purpose form. Firestore path:
// consentFormTemplates/{id}
export interface ConsentFormTemplate extends TenantScoped {
  id: string;
  title: string; // e.g. "Laser Hair Removal Consent"
  body: string;
  sessionType?: SessionType; // if set, this template is suggested for that treatment type
  createdAt: number;
}

// A *signed* instance of a template for a specific patient. `renderedBody`
// is a frozen snapshot of the template text with variables already
// substituted at signing time — deliberately not re-rendered from the live
// template later, so editing a template never rewrites what a patient
// actually agreed to and signed. The signature image is embedded as a base64
// data URL for the same reason as PatientPhoto.dataUrl above (no Firebase
// Storage on the free plan) — signatures are simple line drawings so this
// stays tiny (tens of KB), nowhere near Firestore's 1MiB limit.
// Firestore path: consentForms/{id}
export interface ConsentForm extends TenantScoped {
  id: string;
  patientId: string;
  templateId: string;
  templateTitle: string; // denormalized, survives the template being edited/renamed later
  visitId?: string; // the Visit this consent covers, if any
  renderedBody: string;
  signatureDataUrl: string; // base64 data: URL of the signature PNG
  signedByName: string; // name typed/confirmed at signing — patient, or a guardian signing on their behalf
  witnessUid?: string; // staff member present at signing
  witnessName?: string;
  signedAt: number;
  createdAt: number;
}

// A single line on a Receipt — usually auto-filled from a Visit's fee or a
// Package's total amount, but can also be a free-form custom line (e.g. a
// product sale). `discount`, if set, is subtracted from `amount` (the listed
// price) when computing the line's contribution to the receipt total — see
// components/documents/ReceiptFormModal.tsx.
export interface ReceiptItem {
  description: string;
  amount: number; // listed price for this line, before discount
  discount?: number;
}

// A patient-wise receipt, generated from the Documents section (see
// app/dashboard/documents/page.tsx) rather than the patient page itself,
// since a receipt is a clinic-wide document type alongside consent forms.
// `receiptNumber` is allocated atomically from a per-clinic counter (see
// lib/receiptNumber.ts) so numbers are sequential and never reused, even
// with two staff members issuing receipts at the same time. Patient contact
// details are snapshotted at generation time (same reasoning as
// ConsentForm.renderedBody) so a printed receipt never silently changes if
// the patient's record is edited later.
// Firestore path: receipts/{id}
export interface Receipt extends TenantScoped {
  id: string;
  patientId: string;
  patientName: string; // denormalized, same reasoning as Appointment.patientName
  patientPhone?: string;
  patientAge?: number;
  patientGender?: string;
  patientAddress?: string;
  consultingDoctor?: string;
  receiptNumber: string; // e.g. "RCPT-000123"
  date: string; // YYYY-MM-DD
  items: ReceiptItem[];
  amount: number; // sum of (item.amount - item.discount), denormalized for quick list rendering
  visitId?: string; // if this receipt was generated from a specific visit
  packageId?: string; // if this receipt was generated from a specific package purchase
  appointmentId?: string; // denormalized from the source visit, for the same auto-complete reasoning as Visit.appointmentId
  notes?: string;
  issuedByUid: string;
  issuedByName: string;
  createdAt: number;
}
