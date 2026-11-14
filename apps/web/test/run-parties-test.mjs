import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidEmail,
  isValidTaxRegistrationNumber,
  isValidPhone,
  validatePartyForm,
  CURRENCY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
} from "../src/modules/parties/PartyDrawer.tsx";
import { formatMoney } from "../src/lib/currency.ts";
import { initialMockParties } from "../src/lib/api-mock.ts";

const sampleBillingAddress = {
  line1: "100 Tech Blvd",
  city: "San Francisco",
  state: "CA",
  postalCode: "94105",
  country: "United States",
};

test("Form Validation - legalName is required", () => {
  const input = {
    type: "customer",
    legalName: "",
    tradeName: "Trade Name",
    taxRegistrationNumber: "US-1234567",
    contactPerson: "Jane Doe",
    email: "jane@example.com",
    phone: "+1 555-123-4567",
    currency: "USD",
    paymentTerms: "Net 30",
    status: "active",
    billingAddress: sampleBillingAddress,
    shippingAddress: sampleBillingAddress,
    sameAsBilling: true,
  };
  const errors = validatePartyForm(input);
  assert.equal(errors.legalName, "Legal name is required.");
});

test("Form Validation - tax registration / VAT number", () => {
  assert.equal(isValidTaxRegistrationNumber("US-8492019"), true);
  assert.equal(isValidTaxRegistrationNumber("GB123456789"), true);
  assert.equal(isValidTaxRegistrationNumber("DE-123456789"), true);
  assert.equal(isValidTaxRegistrationNumber("12"), false);
  assert.equal(isValidTaxRegistrationNumber("????"), false);
});

test("Form Validation - email format", () => {
  assert.equal(isValidEmail("billing@deltadynamics.com"), true);
  assert.equal(isValidEmail("user.name+tag@domain.co.uk"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail("user@"), false);
  assert.equal(isValidEmail("@domain.com"), false);
});

test("Form Validation - phone number", () => {
  assert.equal(isValidPhone(""), true);
  assert.equal(isValidPhone("+1 (555) 019-2831"), true);
  assert.equal(isValidPhone("+44 20 7946 0991"), true);
  assert.equal(isValidPhone("abc"), false);
});

test("Form Validation - billing and shipping addresses", () => {
  const incompleteInput = {
    type: "supplier",
    legalName: "Incomplete Supplier LLC",
    tradeName: "",
    taxRegistrationNumber: "US-9938210",
    contactPerson: "Bob Smith",
    email: "bob@example.com",
    phone: "",
    currency: "USD",
    paymentTerms: "Net 60",
    status: "active",
    billingAddress: {
      line1: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
    },
    shippingAddress: {
      line1: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
    },
    sameAsBilling: false,
  };

  const errors = validatePartyForm(incompleteInput);
  assert.equal(errors.billingLine1, "Billing street address is required.");
  assert.equal(errors.billingCity, "Billing city is required.");
  assert.equal(errors.billingPostalCode, "Billing postal code is required.");
  assert.equal(errors.billingCountry, "Billing country is required.");
  assert.equal(errors.shippingLine1, "Shipping street address is required.");
  assert.equal(errors.shippingCity, "Shipping city is required.");
  assert.equal(errors.shippingPostalCode, "Shipping postal code is required.");
  assert.equal(errors.shippingCountry, "Shipping country is required.");
});

test("Form Validation - skips shipping when sameAsBilling is true", () => {
  const sameBillingInput = {
    type: "supplier",
    legalName: "Valid Supplier LLC",
    tradeName: "",
    taxRegistrationNumber: "US-9938210",
    contactPerson: "Bob Smith",
    email: "bob@example.com",
    phone: "",
    currency: "USD",
    paymentTerms: "Net 60",
    status: "active",
    billingAddress: sampleBillingAddress,
    shippingAddress: {
      line1: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
    },
    sameAsBilling: true,
  };

  const errors = validatePartyForm(sameBillingInput);
  assert.equal(errors.billingLine1, undefined);
  assert.equal(errors.shippingLine1, undefined);
  assert.equal(Object.keys(errors).length, 0);
});

test("Party Filtering - customers, suppliers, and both", () => {
  const customers = initialMockParties.filter(
    (p) => p.type === "customer" || p.type === "both"
  );
  const suppliers = initialMockParties.filter(
    (p) => p.type === "supplier" || p.type === "both"
  );
  const both = initialMockParties.filter((p) => p.type === "both");

  assert.ok(customers.length > 0);
  assert.ok(suppliers.length > 0);
  assert.ok(both.length > 0);

  both.forEach((p) => {
    assert.ok(customers.some((c) => c.id === p.id));
    assert.ok(suppliers.some((s) => s.id === p.id));
  });
});

test("Party Filtering - active vs inactive status", () => {
  const activeParties = initialMockParties.filter((p) => p.status === "active");
  const inactiveParties = initialMockParties.filter((p) => p.status === "inactive");

  assert.ok(activeParties.length > 0);
  assert.ok(inactiveParties.length > 0);
  assert.equal(activeParties.length + inactiveParties.length, initialMockParties.length);
});

test("Money Formatting - UI Contract compliance and zero math in browser", () => {
  assert.equal(formatMoney("3450.00", "$"), "$3,450.00");
  assert.equal(formatMoney("0.00", "$"), "$0.00");
  assert.equal(formatMoney("-1240.50", "$"), "-$1,240.50");
  assert.equal(formatMoney("128420.50", "$"), "$128,420.50");
  assert.equal(formatMoney("4850.00", "€"), "€4,850.00");
  assert.equal(formatMoney("620.00", "£"), "£620.00");
});

test("Payment Terms and Currency Options", () => {
  assert.ok(PAYMENT_TERMS_OPTIONS.includes("Due on Receipt"));
  assert.ok(PAYMENT_TERMS_OPTIONS.includes("Net 15"));
  assert.ok(PAYMENT_TERMS_OPTIONS.includes("Net 30"));
  assert.ok(PAYMENT_TERMS_OPTIONS.includes("Net 60"));
  assert.ok(PAYMENT_TERMS_OPTIONS.includes("Net 90"));

  const currencyCodes = CURRENCY_OPTIONS.map((c) => c.value);
  assert.ok(currencyCodes.includes("USD"));
  assert.ok(currencyCodes.includes("EUR"));
  assert.ok(currencyCodes.includes("GBP"));
});
