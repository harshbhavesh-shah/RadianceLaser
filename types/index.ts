// Every clinic's data documents (appointments, patients, etc.) should carry
// a clinicId field, matching this shape. Firestore security rules enforce
// that a user can only read/write documents where clinicId matches their
// own auth token's clinicId claim — see firestore.rules.
export interface TenantScoped {
  clinicId: string;
}

// Every clinic (tenant) that signs up for the product.
// Firestore path: clinics/{clinicId}
export interface Clinic {
  id: string;
  name: string;
  createdAt: number; // ms epoch
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
// Each has its own set of tracked fields — see lib/sessionTypes.ts for the
// column definitions that drive both the table UI and validation.
export type SessionType = "qs" | "lhr";

// A single logged visit/session. Deliberately named `Visit` rather than
// "Session" to avoid colliding with the auth `Session` type above.
export interface Visit extends TenantScoped {
  id: string;
  patientId: string;
  sessionType: SessionType;
  date: string; // YYYY-MM-DD, empty string until a date is actually set
  fields: Record<string, string | number>;
  // Set when this visit is a redemption against a Package rather than a
  // pay-per-visit session. When set, fields.fee should be 0 — the money was
  // already counted as revenue when the package was purchased, so charging
  // again here would double-count it. See lib/analytics.ts.
  packageId?: string;
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
