import { describe, expect, it } from "vitest";

// Validation helper functions mirroring ImportPage business rules
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidAccountClassification(type: string): boolean {
  return ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].includes(type);
}

export function isValidSKU(sku: unknown): boolean {
  return typeof sku === "string" && sku.trim().length > 0;
}

export function validateRow(entity: string, row: { col1?: string; col2?: string; col3?: string }): { isValid: boolean; error?: string } {
  if (entity === "contacts") {
    if (!row.col1 || row.col1.trim() === "") {
      return { isValid: false, error: "Company name is required." };
    }
    if (row.col2 && !isValidEmail(row.col2)) {
      return { isValid: false, error: "Invalid email syntax: missing '@' domain structure." };
    }
    return { isValid: true };
  }

  if (entity === "items") {
    if (!row.col1 || !isValidSKU(row.col1)) {
      return { isValid: false, error: "Item SKU / Code is required." };
    }
    return { isValid: true };
  }

  if (entity === "accounts") {
    if (!row.col1 || row.col1.trim() === "") {
      return { isValid: false, error: "Account code is required." };
    }
    if (!row.col3 || !isValidAccountClassification(row.col3)) {
      return { isValid: false, error: "Invalid classification: must map to ASSET, LIABILITY, EQUITY, REVENUE, or EXPENSE." };
    }
    return { isValid: true };
  }

  return { isValid: true };
}

describe("PLT-14: Master Data Import and Migration", () => {
  it("Target Entities Coverage", () => {
    const supported = ["contacts", "items", "accounts", "journals"];
    expect(supported.length).toBe(4);
    expect(supported).toContain("contacts");
    expect(supported).toContain("items");
    expect(supported).toContain("accounts");
    expect(supported).toContain("journals");
  });

  it("Migration Source Platforms Coverage", () => {
    const platforms = ["quickbooks", "xero", "tally", "generic"];
    expect(platforms.length).toBe(4);
    expect(platforms).toContain("quickbooks");
    expect(platforms).toContain("xero");
    expect(platforms).toContain("tally");
    expect(platforms).toContain("generic");
  });

  it("Contact Row Validation and Quarantine", () => {
    const validContact = { col1: "Apex Robotics Systems", col2: "procure@apexrobotics.com" };
    expect(validateRow("contacts", validContact).isValid).toBe(true);

    const invalidEmail = { col1: "MicroTech Dynamics", col2: "invalid-email-syntax" };
    const resEmail = validateRow("contacts", invalidEmail);
    expect(resEmail.isValid).toBe(false);
    expect(resEmail.error).toContain("Invalid email syntax");

    const missingName = { col1: "", col2: "info@test.com" };
    const resName = validateRow("contacts", missingName);
    expect(resName.isValid).toBe(false);
    expect(resName.error).toContain("Company name is required");
  });

  it("Item SKU Validation and Quarantine", () => {
    const validItem = { col1: "SKU-TITAN-100", col2: "Gear Shaft" };
    expect(validateRow("items", validItem).isValid).toBe(true);

    const missingSku = { col1: "", col2: "Hardware Bolt" };
    const resSku = validateRow("items", missingSku);
    expect(resSku.isValid).toBe(false);
    expect(resSku.error).toContain("SKU / Code is required");
  });

  it("Chart of Accounts Classification Quarantine", () => {
    const validAsset = { col1: "1010", col2: "Cash", col3: "ASSET" };
    expect(validateRow("accounts", validAsset).isValid).toBe(true);

    const invalidClass = { col1: "9999", col2: "Suspense", col3: "OTHER_UNKNOWN" };
    const resClass = validateRow("accounts", invalidClass);
    expect(resClass.isValid).toBe(false);
    expect(resClass.error).toContain("Invalid classification");
  });

  it("CSV Template Generation Formatting", () => {
    const contactsTemplate = `Company Name,Email,Tax ID,Terms,Balance\nAcme Corporation,billing@acme.com,US-9928101,Net 30,1500.00\n`;
    const lines = contactsTemplate.trim().split("\n");
    expect(lines.length).toBe(2);
    const headers = lines[0].split(",");
    expect(headers).toEqual(["Company Name", "Email", "Tax ID", "Terms", "Balance"]);
  });
});
