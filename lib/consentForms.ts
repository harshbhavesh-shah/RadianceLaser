// Shared between the template editor (Settings) and the sign flow (patient
// page) for turning a template's {{variable}} placeholders into the actual
// text a patient reads and signs.

export interface ConsentFormVariables {
  patientName: string;
  clinicName: string;
  date: string; // human-readable, e.g. "22 July 2026"
  treatmentType?: string; // session type label, if linked to a visit/machine type
  area?: string; // treated area, if linked to a visit
}

export interface ConsentVariableDef {
  token: string; // e.g. "patientName" — used as {{patientName}} in template bodies
  label: string; // shown on the "insert variable" button
  description: string;
}

export const CONSENT_VARIABLES: ConsentVariableDef[] = [
  { token: "patientName", label: "Patient Name", description: "Filled in automatically for each patient." },
  { token: "clinicName", label: "Clinic Name", description: "Your clinic's name." },
  { token: "date", label: "Date", description: "The date the form is signed." },
  { token: "treatmentType", label: "Treatment Type", description: "e.g. Q-Switch, Laser Hair Removal — only if linked to a session." },
  { token: "area", label: "Treated Area", description: "e.g. Underarms — only if linked to a session." },
];

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z]+)\s*\}\}/g;

/** Substitutes {{variable}} placeholders with their values. Unknown or
 * unset variables (e.g. {{treatmentType}} with no linked visit) are left as
 * an em-dash rather than silently vanishing, so a gap is obvious to whoever
 * reviews the form before it's signed. */
export function renderConsentTemplate(body: string, vars: ConsentFormVariables): string {
  return body.replace(TOKEN_PATTERN, (_match, token: string) => {
    const value = (vars as Record<string, string | undefined>)[token];
    return value && value.trim() ? value : "—";
  });
}

export interface ConsentStarterTemplate {
  title: string;
  body: string;
}

/** Boilerplate offered when creating a new template, so a clinic isn't
 * staring at a blank textarea — always meant to be reviewed/edited by the
 * clinic (and ideally their own legal counsel) before real use, not used
 * as-is. */
export const CONSENT_STARTER_TEMPLATES: ConsentStarterTemplate[] = [
  {
    title: "General Treatment Consent",
    body: `I, {{patientName}}, confirm that I am voluntarily undergoing {{treatmentType}} treatment at {{clinicName}} on {{date}}.

I confirm that:
- I have disclosed my full medical history, including any medications, allergies, pregnancy, or skin conditions, to the treating staff.
- The procedure, expected results, and possible side effects (including but not limited to redness, swelling, temporary discoloration, or discomfort) have been explained to me.
- I understand that results vary between individuals and that no specific outcome has been guaranteed.
- I have had the opportunity to ask questions and they have been answered to my satisfaction.
- I consent to the treatment of the area: {{area}}.

By signing below, I give my informed consent to proceed with this treatment.`,
  },
  {
    title: "Photography & Before/After Photo Consent",
    body: `I, {{patientName}}, consent to {{clinicName}} taking before/after photographs of me in connection with my treatment on {{date}}.

I understand that:
- These photographs will be used for my clinical record, to track my treatment progress over time.
- Photographs of sensitive areas will be stored securely and access-limited within the clinic's system.
- Separate, explicit permission will be sought before any photograph is used for marketing, social media, or promotional purposes, and I may decline that without affecting my treatment.
- I may withdraw this consent at any time by notifying the clinic in writing.

By signing below, I confirm my consent as described above.`,
  },
  {
    title: "Laser Hair Removal Consent",
    body: `I, {{patientName}}, consent to undergo Laser Hair Removal treatment at {{clinicName}} on {{date}}, for the area: {{area}}.

I confirm that:
- I have disclosed any history of keloid scarring, photosensitivity, recent sun exposure/tanning, isotretinoin use, or pregnancy.
- I understand multiple sessions are typically required for visible results, and results vary by hair type, skin type, and hormonal factors.
- I understand possible side effects include temporary redness, swelling, or, rarely, blistering or pigmentation changes, and I will follow the aftercare instructions provided.
- I have had the opportunity to ask questions and they have been answered to my satisfaction.

By signing below, I give my informed consent to proceed.`,
  },
];
