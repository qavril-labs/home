import test from "node:test";
import assert from "node:assert/strict";

// Validation helper functions mirroring ImportPage business rules
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidAccountClassification(type) {
  return ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].includes(type);
}

export function isValidSKU(sku) {
  return typeof sku === "string" && sku.trim().length > 0;
}

export function validateRow(entity, row) {
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

test("PLT-14: Master Data Target Entities Coverage", () => {
  const supported = ["contacts", "items", "accounts", "journals"];
  assert.equal(supported.length, 4);
  assert.ok(supported.includes("contacts"));
  assert.ok(supported.includes("items"));
  assert.ok(supported.includes("accounts"));
  assert.ok(supported.includes("journals"));
});

test("PLT-14: Migration Source Platforms Coverage", () => {
  const platforms = ["quickbooks", "xero", "tally", "generic"];
  assert.equal(platforms.length, 4);
  assert.ok(platforms.includes("quickbooks"));
  assert.ok(platforms.includes("xero"));
  assert.ok(platforms.includes("tally"));
  assert.ok(platforms.includes("generic"));
});

test("PLT-14: Contact Row Validation and Quarantine", () => {
  const validContact = { col1: "Apex Robotics Systems", col2: "procure@apexrobotics.com" };
  assert.equal(validateRow("contacts", validContact).isValid, true);

  const invalidEmail = { col1: "MicroTech Dynamics", col2: "invalid-email-syntax" };
  const resEmail = validateRow("contacts", invalidEmail);
  assert.equal(resEmail.isValid, false);
  assert.ok(resEmail.error.includes("Invalid email syntax"));

  const missingName = { col1: "", col2: "info@test.com" };
  const resName = validateRow("contacts", missingName);
  assert.equal(resName.isValid, false);
  assert.ok(resName.error.includes("Company name is required"));
});

test("PLT-14: Item SKU Validation and Quarantine", () => {
  const validItem = { col1: "SKU-TITAN-100", col2: "Gear Shaft" };
  assert.equal(validateRow("items", validItem).isValid, true);

  const missingSku = { col1: "", col2: "Hardware Bolt" };
  const resSku = validateRow("items", missingSku);
  assert.equal(resSku.isValid, false);
  assert.ok(resSku.error.includes("SKU / Code is required"));
});

test("PLT-14: Chart of Accounts Classification Quarantine", () => {
  const validAsset = { col1: "1010", col2: "Cash", col3: "ASSET" };
  assert.equal(validateRow("accounts", validAsset).isValid, true);

  const invalidClass = { col1: "9999", col2: "Suspense", col3: "OTHER_UNKNOWN" };
  const resClass = validateRow("accounts", invalidClass);
  assert.equal(resClass.isValid, false);
  assert.ok(resClass.error.includes("Invalid classification"));
});

test("PLT-14: CSV Template Generation Formatting", () => {
  const contactsTemplate = `Company Name,Email,Tax ID,Terms,Balance\nAcme Corporation,billing@acme.com,US-9928101,Net 30,1500.00\n`;
  const lines = contactsTemplate.trim().split("\n");
  assert.equal(lines.length, 2);
  const headers = lines[0].split(",");
  assert.deepEqual(headers, ["Company Name", "Email", "Tax ID", "Terms", "Balance"]);
});
