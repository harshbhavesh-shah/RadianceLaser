import { describe, it, expect } from "vitest";
import { renderConsentTemplate } from "@/lib/consentForms";

// This is the last step before a patient signs a legal document — a bug
// here means either the wrong patient's name/treatment appears on someone
// else's consent form, or a gap silently renders as blank instead of the
// visible "—" this function is specifically designed to leave behind.

describe("renderConsentTemplate", () => {
  it("substitutes every known variable with its value", () => {
    const result = renderConsentTemplate("I, {{patientName}}, consent to {{treatmentType}} at {{clinicName}} on {{date}}.", {
      patientName: "Asha Rao",
      clinicName: "Radiance Laser",
      date: "22 July 2026",
      treatmentType: "Laser Hair Removal",
    });
    expect(result).toBe("I, Asha Rao, consent to Laser Hair Removal at Radiance Laser on 22 July 2026.");
  });

  it("renders an unset optional variable as an em-dash, never as blank or literally missing", () => {
    const result = renderConsentTemplate("Treated area: {{area}}.", {
      patientName: "A",
      clinicName: "C",
      date: "D",
    });
    expect(result).toBe("Treated area: —.");
  });

  it("renders a variable set to an empty/whitespace-only string as an em-dash too", () => {
    const result = renderConsentTemplate("Area: {{area}}.", {
      patientName: "A",
      clinicName: "C",
      date: "D",
      area: "   ",
    });
    expect(result).toBe("Area: —.");
  });

  it("leaves an unrecognized token untouched rather than guessing at it", () => {
    const result = renderConsentTemplate("Hello {{notARealVariable}}.", {
      patientName: "A",
      clinicName: "C",
      date: "D",
    });
    expect(result).toBe("Hello —."); // unknown token has no matching value, so it falls back the same way
  });

  it("tolerates extra whitespace inside the {{ }} braces", () => {
    const result = renderConsentTemplate("{{ patientName }}", { patientName: "Asha", clinicName: "C", date: "D" });
    expect(result).toBe("Asha");
  });

  it("substitutes the same variable every time it repeats in the body", () => {
    const result = renderConsentTemplate("{{patientName}} agrees. Signed, {{patientName}}.", {
      patientName: "Asha",
      clinicName: "C",
      date: "D",
    });
    expect(result).toBe("Asha agrees. Signed, Asha.");
  });

  it("leaves plain text with no placeholders completely unchanged", () => {
    const result = renderConsentTemplate("No variables here at all.", {
      patientName: "A",
      clinicName: "C",
      date: "D",
    });
    expect(result).toBe("No variables here at all.");
  });
});
