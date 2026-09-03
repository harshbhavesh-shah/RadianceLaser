// Every clinic's data documents (appointments, patients, etc.) should carry
// a clinicId field, matching this shape. Firestore security rules enforce
// that a user can only read/write documents where clinicId matches their
// own auth token's clinicId claim — see firestore.rules.
export interface TenantScoped {
  clinicId: string;
}

export type StatsWindow = "today" | "week" | "month";

// "trialing": within the free trial window (see Clinic.trialEndsAt).
// "active": has paid for the current period (see Clinic.subscriptionRenewsAt)
//   — set by the Razorpay payment-verification flow (lib/razorpay.ts,
//   app/dashboard/billing/actions.ts) once a payment is confirmed, either
//   via the client-side checkout callback or the webhook, whichever lands
//   first (both are idempotent on the Razorpay payment ID — see
//   lib/firestore/payments.ts).
// "canceled": was "active", but subscriptionRenewsAt has passed with no
//   renewal payment recorded. Nothing currently sets this explicitly — it's
//   the fallback lib/subscription.ts treats an unrecognized/absent status
//   as, same as an "active" clinic whose renewsAt has lapsed.
export type SubscriptionStatus = "trialing" | "active" | "canceled";

// Every clinic (tenant) that signs up for the product.
// Firestore path: clinics/{clinicId}
export interface Clinic {
  id: string;
  name: string;
  createdAt: number; // ms epoch
  address?: string; // shown on printed documents (receipts) — see Settings > Clinic Profile
  // Per-clinic preferences, editable from Settings — see app/dashboard/settings.
  statsWindow?: StatsWindow; // defaults to "today" if unset
  // See lib/subscription.ts getClinicAccess for how these two combine into
  // the actual "can this clinic make changes right now" decision — mirrored
  // in firestore.rules' clinicIsActive() as the real enforcement boundary,
  // the same layering as auth (see README's auth/multi-tenancy section).
  // Clinics created before this field existed are backfilled to "active"
  // (grandfathered, not retroactively put on a trial clock) — see
  // scripts/backfillClinicSubscriptions.mjs.
  subscriptionStatus: SubscriptionStatus;
  // Epoch ms when the free trial ends. Only meaningful while
  // subscriptionStatus is "trialing".
  trialEndsAt: number;
  // Epoch ms the current paid period runs through. Only meaningful while
  // subscriptionStatus is "active" — set/extended by each confirmed annual
  // payment (see lib/razorpay.ts). Absent until a clinic's first payment.
  subscriptionRenewsAt?: number;
  // Automated WhatsApp messaging preferences — see Settings > Communication
  // and app/api/cron/send-scheduled-messages. Both independently toggled;
  // each is a no-op at send time unless WhatsApp is actually connected and
  // the matching template ("appointment_reminder" / "visit_feedback") exists.
  reminderEnabled: boolean;
  reminderHoursBefore: number;
  feedbackSurveyEnabled: boolean;
  feedbackSurveyDelayHours: number;
}

// One Razorpay payment attempt for a clinic's annual subscription — created
// as "created" when the checkout order is opened, updated to "paid" once
// verified (client-side signature check or webhook, whichever arrives
// first) or left as "created"/"failed" otherwise. Kept even for
// failed/abandoned attempts so Settings > Billing has an honest history,
// and so the future admin panel can see payment activity across clinics.
// Firestore path: payments/{id}
export interface Payment extends TenantScoped {
  id: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string; // set once a payment is actually made against the order
  amount: number; // in the smallest currency unit (paise for INR), matching what Razorpay uses
  currency: string; // e.g. "INR"
  status: "created" | "paid" | "failed";
  createdAt: number;
  paidAt?: number;
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
  // True if this account also carries the platform-level `superAdmin`
  // custom claim (see scripts/grantSuperAdmin.mjs) — independent of
  // clinicId/role, since a super-admin isn't scoped to any one clinic. Lets
  // the same account be both a clinic's owner AND the platform admin,
  // without one identity fighting the other. Only used to decide whether to
  // show a link to /admin (see components/Sidebar.tsx) — the actual /admin
  // access check is AdminSession/getAdminSession() below, not this flag.
  isSuperAdmin: boolean;
}

// The decoded, verified session for the platform-level admin panel
// (app/admin) — deliberately a separate type from Session above, since a
// super-admin isn't scoped to a clinicId/role at all. See
// lib/session.ts getAdminSession() and scripts/grantSuperAdmin.mjs for how
// an account gets this claim.
export interface AdminSession {
  uid: string;
  email: string | null;
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
  // Digits-only form of `phone` (see lib/phone.ts normalizePhone), kept in
  // sync on every create/update so findPatientByPhone can query this field
  // directly instead of scanning every patient in the clinic. Never shown in
  // the UI — `phone` is still the display value.
  phoneNormalized: string;
  // Lowercased form of `name`, kept in sync on every create/update so
  // searchPatients can do a case-insensitive prefix query (Firestore has no
  // case-insensitive comparison) without loading the whole clinic roster.
  // Never shown in the UI.
  nameLower: string;
  skinType?: SkinType;
  contraindications?: string; // free text: pregnancy, isotretinoin, photosensitizing meds, etc.
  // The patient's numeric ID in the clinic's old Access-based system
  // (AdvanceSMS.mdb `patientno`), for anyone cross-referencing an old
  // paper file — see scripts/importAdvanceSMS.mjs. Absent on every patient
  // created in the app itself.
  legacyPatientNo?: number;
  // Epoch ms the patient consented to their data being processed (DPDP Act
  // 2023 §5-7) — distinct from ConsentForm, which records consent to a
  // clinical procedure. Absent on patients created before this existed.
  dataConsentAt?: number;
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
  // Only meaningful for a direct-pay visit (no packageId) — how the fee for
  // THIS visit was paid. Absent on package-covered visits (no new payment
  // happens there) and on visits logged before this field existed.
  paymentMethod?: PaymentMethod;
  // Optional "check back in" date for this visit — e.g. a doctor wants to
  // confirm there's no reaction in 3 days, or nudge toward booking the next
  // session in a few weeks. Surfaced on Overview's "Needs Attention" list
  // once it's due (see lib/overview.ts computeFollowUpAlerts) so it doesn't
  // rely on anyone remembering to check back manually. followUpNote is free
  // text for what the follow-up is actually about.
  followUpDate?: string; // YYYY-MM-DD
  followUpNote?: string;
  // The row's `xauto` id in the clinic's old Access-based system
  // (AdvanceSMS.mdb Patient_visit_Qswitch/patient_visit_Detail), for
  // tracing an imported visit back to its original source row — see
  // scripts/importAdvanceSMS.mjs. Absent on every visit logged in the app
  // itself. sessionType already indicates which of the two legacy tables
  // this came from, so this id alone is enough to find the row.
  legacyVisitNo?: number;
  createdAt: number;
}

// A post-visit satisfaction survey — see app/api/cron/send-scheduled-
// messages (creates + sends these) and the public app/feedback/[token]
// page a patient lands on from the WhatsApp link. `token` is the only
// thing that URL carries; deliberately opaque so a shared/guessed link
// can't be walked to find other patients' responses.
export interface VisitFeedback extends TenantScoped {
  id: string;
  visitId: string;
  patientName: string;
  token: string;
  rating?: number; // 1-5; absent until the patient responds
  comment?: string;
  sentAt?: number;
  respondedAt?: number;
  createdAt: number;
}

// One of a clinic's configurable automated follow-ups for a missed
// appointment — see prisma/schema.prisma's NoShowFollowUp comment for the
// full reasoning (why `kind` doesn't change the send mechanics, why
// `delayHours` is measured from the appointment's own time). Settings UI:
// components/no-shows/FollowUpsSection.tsx.
export type NoShowFollowUpKind = "survey" | "incentive" | "reminder" | "custom";

export interface NoShowFollowUp extends TenantScoped {
  id: string;
  name: string;
  kind: NoShowFollowUpKind;
  templateId: string;
  offerText?: string;
  enabled: boolean;
  delayHours: number;
  createdAt: number;
}

// A "why didn't you come in" response — only exists for an appointment
// once a kind:"survey" NoShowFollowUp has actually fired for it. See
// prisma/schema.prisma's schema comment for the token-based public-page
// pattern this mirrors from VisitFeedback.
export type NoShowReason = "forgot" | "schedule_conflict" | "found_elsewhere" | "cost" | "other";

export interface NoShowSurveyResponse extends TenantScoped {
  id: string;
  appointmentId: string;
  patientName: string;
  token: string;
  reason?: NoShowReason;
  comment?: string;
  sentAt?: number;
  respondedAt?: number;
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
  // How the purchase was actually paid — absent on packages sold before
  // this field existed (see lib/analyticsPage.ts computeCashFlowSummary for
  // how those show up as "unspecified" rather than being guessed at).
  paymentMethod?: PaymentMethod;
  createdAt: number;
}

// How money for a session or package actually came in — separate from
// *whether* a visit was direct-pay or package-covered (that's
// Visit.packageId). A package-covered visit has no paymentMethod of its
// own since no new money changes hands at that visit; the payment was
// already made (and recorded) on the package's own purchase.
export type PaymentMethod = "cash" | "online";

// Derived, not stored — see computePackageStatus in lib/firestore/packages.ts.
export type PackageStatus = "active" | "completed" | "expired";

export type AppointmentStatus = "booked" | "completed" | "cancelled" | "no-show";

export interface Appointment extends TenantScoped {
  id: string;
  // Absent for a public booking (see app/api/public/appointments/route.ts)
  // that staff haven't linked to a patient record yet — the anonymous
  // booker isn't known to be any existing Patient. Set the moment staff
  // link it (UnlinkedBookingPanel) or edit/save it directly
  // (AppointmentFormModal), and never unset again after that.
  patientId?: string;
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
  // Set once the automated reminder cron has sent a message for this
  // appointment — see app/api/cron/send-scheduled-messages.
  reminderSentAt?: number;
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
  // Opt-in per staff member — see lib/twoFactor.ts and
  // app/login/actions.ts requestTwoFactorIfEnabledAction(). Absent/false
  // means ordinary single-factor sign-in. Each person manages their own;
  // there's no owner-mandated "require this for everyone" yet.
  twoFactorEnabled?: boolean;
  // Both per-staff-member, not per-clinic — see components/onboarding/.
  // tourCompleted flips true the first time this person finishes or skips
  // the guided product tour, so it only ever auto-launches once per
  // person. onboardingDismissed flips true if they close the setup
  // checklist, regardless of how many steps are actually done — a
  // deliberate simplification over tracking "seen at N/5 done" separately.
  tourCompleted?: boolean;
  onboardingDismissed?: boolean;
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

// A clinic-editable entry in the "Area" dropdown on the Q-Switch/LHR visit
// form (see components/VisitFormModal.tsx and lib/sessionTypes.ts) —
// Settings → Treatment Areas lets a clinic add its own or edit these three
// fields. `name` is what actually gets stored on a Visit's area fields
// (plain text, not a reference to this row — see AreaDef's schema comment).
export interface AreaDef extends TenantScoped {
  id: string;
  sessionType: SessionType; // "qs" or "lhr" — which visit form's Area dropdown this belongs to
  name: string;
  defaultDurationMinutes?: number; // suggests the visit's total Duration (min) when picked, not enforced
  gstApplicable: boolean; // clinic's own call — genuinely varies by treatment area
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

// ---------------------------------------------------------------------------
// WhatsApp messaging (see lib/bhashsms/, components/communication/). Built
// against BhashSMS — the clinic's own WhatsApp Business API provider — as a
// simple GET-based send API (no OAuth, no partner account): a clinic
// username/password/sender id, called directly per send. Templates are
// authored and approved entirely on BhashSMS/Meta's own dashboard, outside
// this app; all this app stores is the approved template's exact name and
// how many/which variables it expects, so a send can fill them in in the
// right order. See lib/bhashsms/client.ts for the actual HTTP call.
export type WhatsAppConnectionStatus = "not_connected" | "connected" | "error";

// Firestore path: whatsappConnections/{clinicId} — one per clinic, doc id
// deliberately equals clinicId rather than being a random id, since a
// clinic can only ever have exactly one connection.
export interface WhatsAppConnection extends TenantScoped {
  id: string;
  status: WhatsAppConnectionStatus;
  bhashUser: string; // BhashSMS account username, e.g. "Advancedskinclinic"
  // Deliberately never included in anything returned to a "use client"
  // component — server actions expose only a redacted status/bhashUser/
  // senderId view, never this field itself. A production deployment
  // handling real customer credentials at scale should encrypt this at
  // rest (e.g. via a KMS) rather than storing it as a plain field; left as
  // plain text for now, same reasoning as the old byoApiKey field this
  // replaces — already behind both Firestore's per-clinic isolation rules
  // and the server-only read path.
  bhashPass?: string;
  senderId: string; // BhashSMS "sender" param, e.g. "BUZWAP"
  lastError?: string;
  connectedAt?: number;
  updatedAt: number;
}

export type MessageTemplateCategory =
  | "appointment_reminder"
  | "appointment_confirmation"
  | "receipt_sent"
  | "visit_feedback"
  | "no_show_followup"
  | "custom";

// The built-in categories are wired to specific places in the app
// (receipt_sent → ReceiptViewModal's "Send via WhatsApp" button,
// appointment_reminder/visit_feedback/no_show_followup → the
// scheduled-messages cron, see app/api/cron/send-scheduled-messages) that
// fill in the template's variables automatically from real data, in this
// fixed order — see lib/bhashsms/send.ts. Because of that, their variable
// count/order isn't editable when creating a template: it has to match
// what the app actually fills in. "custom" has no automatic trigger yet,
// so its variables are freely defined instead.
//
// no_show_followup's second variable's meaning depends on which
// NoShowFollowUp is sending it (see that model's schema comment) — a
// survey link, an offer/discount line, or blank — but it's always exactly
// one template covering all of a clinic's no-show follow-ups, not one
// template per follow-up kind.
export const TEMPLATE_VARIABLE_LABELS: Record<Exclude<MessageTemplateCategory, "custom">, string[]> = {
  appointment_reminder: ["Patient name", "Date", "Time"],
  appointment_confirmation: ["Patient name", "Date", "Time"],
  receipt_sent: ["Patient name", "Receipt number", "Amount"],
  visit_feedback: ["Patient name", "Feedback link"],
  no_show_followup: ["Patient name", "Offer, link, or blank"],
};

// Firestore path: messageTemplates/{id}
export interface MessageTemplate extends TenantScoped {
  id: string;
  name: string; // must exactly match the template name approved on BhashSMS/Meta's side — this is the `text` param on send
  category: MessageTemplateCategory;
  // For "custom" templates only, since the built-in categories' labels are
  // fixed (see TEMPLATE_VARIABLE_LABELS) — free text a staff member sets to
  // remember what each of the template's approved {{n}} placeholders means.
  variableLabels: string[];
  // Optional, for staff reference only when picking a template — NOT sent
  // anywhere. The actual approved wording lives on BhashSMS/Meta's side;
  // this app never sees or controls it, only the template name + params.
  bodyPreview?: string;
  createdAt: number;
  updatedAt: number;
}

export type MessageDirection = "inbound" | "outbound";
export type MessageDeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed";

// One thread per distinct phone number per clinic — a patient's WhatsApp
// conversation, whether or not that number currently matches a patient
// record (patientId/patientName are best-effort links, not required).
// Firestore path: whatsappConversations/{id}
export interface WhatsAppConversation extends TenantScoped {
  id: string;
  patientId?: string;
  patientName?: string; // denormalized snapshot, same reasoning as Appointment.patientName
  phoneNumber: string; // E.164, e.g. "+919876543210"
  lastMessagePreview: string;
  lastMessageAt: number;
  unreadCount: number;
  updatedAt: number;
}

// Firestore path: whatsappMessages/{id}
export interface WhatsAppMessage extends TenantScoped {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  body: string;
  status: MessageDeliveryStatus;
  templateId?: string; // set for outbound template-based sends
  providerMessageId?: string; // BhashSMS's response id/reference for this send, if any
  createdAt: number;
}
