import { describe, it, expect } from "vitest";
import { guessColumnMapping, mapImportRow, type ColumnMapping } from "@/lib/patientImport";

// A clinic's very first action on this product is often importing their
// existing patient list from a spreadsheet — get this wrong and they either
// lose patients on day one (silently dropped rows) or import garbage data
// they then have to manually clean up, both of which are a terrible first
// impression, if not a genuine data-loss incident.

describe("guessColumnMapping", () => {
  it("matches exact known synonyms case-insensitively", () => {
    const mapping = guessColumnMapping(["Full Name", "Mobile Number", "Email Address"]);
    expect(mapping.name).toBe("Full Name");
    expect(mapping.phone).toBe("Mobile Number");
    expect(mapping.email).toBe("Email Address");
  });

  it("trims stray whitespace around header names before matching", () => {
    const mapping = guessColumnMapping(["  Name  ", " Phone "]);
    expect(mapping.name).toBe("  Name  ");
    expect(mapping.phone).toBe(" Phone ");
  });

  it("leaves a field unmapped when no header matches any known synonym", () => {
    const mapping = guessColumnMapping(["Some Unrelated Column"]);
    expect(mapping.name).toBeUndefined();
    expect(mapping.phone).toBeUndefined();
  });

  it("recognizes UHID/MRN-style headers for the optional patient code field", () => {
    expect(guessColumnMapping(["UHID"]).patientCode).toBe("UHID");
    expect(guessColumnMapping(["Medical Record Number"]).patientCode).toBe("Medical Record Number");
  });

  it("recognizes Fitzpatrick as a synonym for skin type", () => {
    expect(guessColumnMapping(["Fitzpatrick Type"]).skinType).toBe("Fitzpatrick Type");
  });
});

describe("mapImportRow", () => {
  const fullMapping: ColumnMapping = {
    name: "Name",
    phone: "Phone",
    age: "Age",
    skinType: "Skin Type",
  };

  it("maps a complete row to a ready-to-import patient with no missing fields", () => {
    const result = mapImportRow({ Name: "Asha Rao", Phone: "9876543210", Age: "34", "Skin Type": "III" }, fullMapping, 0);
    expect(result.missingRequired).toEqual([]);
    expect(result.row).toEqual({ name: "Asha Rao", phone: "9876543210", age: 34, skinType: "III" });
  });

  it("flags Name as missing when its mapped column is blank", () => {
    const result = mapImportRow({ Name: "", Phone: "9876543210" }, fullMapping, 2);
    expect(result.row).toBeNull();
    expect(result.missingRequired).toEqual(["Name"]);
    expect(result.sourceRowIndex).toBe(2);
  });

  it("flags both Name and Phone as missing, and lists both, when neither is mapped", () => {
    const result = mapImportRow({}, {}, 0);
    expect(result.missingRequired).toEqual(["Name", "Phone"]);
  });

  it("accepts a numeric skin-type alias (\"3\") and normalizes it to the app's I-VI scale", () => {
    const result = mapImportRow({ Name: "A", Phone: "1", "Skin Type": "3" }, fullMapping, 0);
    expect(result.row?.skinType).toBe("III");
  });

  it("drops an unrecognized skin-type value rather than importing garbage", () => {
    const result = mapImportRow({ Name: "A", Phone: "1", "Skin Type": "not a type" }, fullMapping, 0);
    expect(result.row?.skinType).toBeUndefined();
  });

  it("drops a non-numeric age rather than importing NaN", () => {
    const result = mapImportRow({ Name: "A", Phone: "1", Age: "not a number" }, fullMapping, 0);
    expect(result.row?.age).toBeUndefined();
  });

  it("omits optional fields entirely from the result when blank, rather than including them as empty strings", () => {
    const result = mapImportRow({ Name: "A", Phone: "1" }, fullMapping, 0);
    expect(result.row).toEqual({ name: "A", phone: "1" });
    expect("age" in (result.row ?? {})).toBe(false);
  });

  it("reads from the mapped header even when the spreadsheet's other columns are unrelated", () => {
    const mapping: ColumnMapping = { name: "Patient", phone: "Contact" };
    const result = mapImportRow({ Patient: "Rohan", Contact: "9999999999", Notes: "irrelevant" }, mapping, 0);
    expect(result.row).toEqual({ name: "Rohan", phone: "9999999999" });
  });
});
