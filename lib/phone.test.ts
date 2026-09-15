import { describe, it, expect } from "vitest";
import { normalizePhone, isValidPhone } from "@/lib/phone";

// Every automated WhatsApp send (reminders, feedback surveys, no-show
// follow-ups — see app/api/cron/send-scheduled-messages) and every bulk
// patient import both run through normalizePhone first. Get it wrong and a
// message silently never sends, or two different patients get merged as
// "the same number" during import.

describe("normalizePhone", () => {
  it("strips spaces, dashes, and a leading +91", () => {
    expect(normalizePhone("+91-9876543210")).toBe("919876543210");
    expect(normalizePhone("98765 43210")).toBe("9876543210");
  });

  it("two differently-formatted inputs for the same real number normalize identically", () => {
    expect(normalizePhone("+91 98765-43210")).toBe(normalizePhone("919876543210"));
  });

  it("returns an empty string for input with no digits at all, rather than throwing", () => {
    expect(normalizePhone("n/a")).toBe("");
  });

  it("drops parentheses and other punctuation, keeping only digits", () => {
    expect(normalizePhone("(987) 654-3210")).toBe("9876543210");
  });
});

describe("isValidPhone", () => {
  it("accepts a plain 10-digit Indian mobile number", () => {
    expect(isValidPhone("9876543210")).toBe(true);
  });

  it("accepts the same number with a country code and formatting", () => {
    expect(isValidPhone("+91 98765 43210")).toBe(true);
  });

  it("rejects a number that's clearly missing digits (the fat-finger case)", () => {
    expect(isValidPhone("98765")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidPhone("")).toBe(false);
  });

  it("rejects an unreasonably long string of digits", () => {
    expect(isValidPhone("1".repeat(20))).toBe(false);
  });

  it("accepts the boundary lengths (7 and 15 digits)", () => {
    expect(isValidPhone("1234567")).toBe(true);
    expect(isValidPhone("1".repeat(15))).toBe(true);
  });
});
