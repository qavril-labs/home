import { describe, expect, it } from "vitest";
import {
  isValidEmail,
  isValidTaxRegistrationNumber,
  isValidPhone,
  validatePartyForm,
  CURRENCY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  type PartyFormInput,
} from "../src/modules/parties/PartyDrawer";
import { formatMoney } from "../src/lib/currency";
import { initialMockParties } from "../src/lib/api-mock";
import type { Party, PartyAddress } from "../src/types";

describe("MDM-01 Customers & Suppliers Master Data (Party Master)", () => {
  const sampleBillingAddress: PartyAddress = {
    line1: "100 Tech Blvd",
    city: "San Francisco",
    state: "CA",
    postalCode: "94105",
    country: "United States",
  };

  const sampleShippingAddress: PartyAddress = {
    line1: "500 Logistics Way",
    city: "Oakland",
    state: "CA",
    postalCode: "94607",
    country: "United States",
  };

  describe("Form Validation (PartyDrawer)", () => {
    it("validates that legalName is required", () => {
      const input: PartyFormInput = {
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
      expect(errors.legalName).toBe("Legal name is required.");
    });

    it("validates tax registration / VAT number correctly", () => {
      expect(isValidTaxRegistrationNumber("US-8492019")).toBe(true);
      expect(isValidTaxRegistrationNumber("GB123456789")).toBe(true);
      expect(isValidTaxRegistrationNumber("DE-123456789")).toBe(true);
      expect(isValidTaxRegistrationNumber("12")).toBe(false); // too short
      expect(isValidTaxRegistrationNumber("????")).toBe(false); // invalid chars

      const input: PartyFormInput = {
        type: "customer",
        legalName: "Valid Corp",
        tradeName: "Valid Corp",
        taxRegistrationNumber: "bad",
        contactPerson: "Jane Doe",
        email: "jane@example.com",
        phone: "",
        currency: "USD",
        paymentTerms: "Net 30",
        status: "active",
        billingAddress: sampleBillingAddress,
        shippingAddress: sampleBillingAddress,
        sameAsBilling: true,
      };

      const errors = validatePartyForm(input);
      expect(errors.taxRegistrationNumber).toContain("Enter a valid Tax ID");
    });

    it("validates email formatting strictly", () => {
      expect(isValidEmail("billing@deltadynamics.com")).toBe(true);
      expect(isValidEmail("user.name+tag@domain.co.uk")).toBe(true);
      expect(isValidEmail("not-an-email")).toBe(false);
      expect(isValidEmail("user@")).toBe(false);
      expect(isValidEmail("@domain.com")).toBe(false);
    });

    it("validates optional phone number when present", () => {
      expect(isValidPhone("")).toBe(true);
      expect(isValidPhone("+1 (555) 019-2831")).toBe(true);
      expect(isValidPhone("+44 20 7946 0991")).toBe(true);
      expect(isValidPhone("abc")).toBe(false);
    });

    it("validates billing and shipping address fields", () => {
      const incompleteInput: PartyFormInput = {
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
      expect(errors.billingLine1).toBe("Billing street address is required.");
      expect(errors.billingCity).toBe("Billing city is required.");
      expect(errors.billingPostalCode).toBe("Billing postal code is required.");
      expect(errors.billingCountry).toBe("Billing country is required.");
      expect(errors.shippingLine1).toBe("Shipping street address is required.");
      expect(errors.shippingCity).toBe("Shipping city is required.");
      expect(errors.shippingPostalCode).toBe("Shipping postal code is required.");
      expect(errors.shippingCountry).toBe("Shipping country is required.");
    });

    it("skips shipping address validation when sameAsBilling is true", () => {
      const sameBillingInput: PartyFormInput = {
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
      expect(errors.billingLine1).toBeUndefined();
      expect(errors.shippingLine1).toBeUndefined();
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe("Party Filtering and Tabs (PartyList)", () => {
    it("correctly partitions customers, suppliers, and both", () => {
      const customers = initialMockParties.filter(
        (p) => p.type === "customer" || p.type === "both"
      );
      const suppliers = initialMockParties.filter(
        (p) => p.type === "supplier" || p.type === "both"
      );
      const both = initialMockParties.filter((p) => p.type === "both");

      expect(customers.length).toBeGreaterThan(0);
      expect(suppliers.length).toBeGreaterThan(0);
      expect(both.length).toBeGreaterThan(0);

      // Verify that parties with type "both" appear in both tabs
      both.forEach((p) => {
        expect(customers).toContainEqual(p);
        expect(suppliers).toContainEqual(p);
      });
    });

    it("filters by status: active vs inactive", () => {
      const activeParties = initialMockParties.filter((p) => p.status === "active");
      const inactiveParties = initialMockParties.filter((p) => p.status === "inactive");

      expect(activeParties.length).toBeGreaterThan(0);
      expect(inactiveParties.length).toBeGreaterThan(0);
      expect(activeParties.length + inactiveParties.length).toBe(initialMockParties.length);
    });

    it("searches across company name, contact, email, and tax ID", () => {
      const searchTarget = initialMockParties[0]!;
      const q = searchTarget.tradeName.toLowerCase();

      const matched = initialMockParties.filter(
        (p) =>
          p.tradeName.toLowerCase().includes(q) ||
          p.legalName.toLowerCase().includes(q) ||
          p.contactPerson.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.taxRegistrationNumber.toLowerCase().includes(q)
      );

      expect(matched.length).toBeGreaterThanOrEqual(1);
      expect(matched[0]!.id).toBe(searchTarget.id);
    });
  });

  describe("Money Formatting (UI Contract Compliance)", () => {
    it("formats decimal string balances as currency with zero arithmetic in browser", () => {
      expect(formatMoney("3450.00", "$")).toBe("$3,450.00");
      expect(formatMoney("0.00", "$")).toBe("$0.00");
      expect(formatMoney("-1240.50", "$")).toBe("-$1,240.50");
      expect(formatMoney("128420.50", "$")).toBe("$128,420.50");
      expect(formatMoney("4850.00", "€")).toBe("€4,850.00");
      expect(formatMoney("620.00", "£")).toBe("£620.00");
    });
  });

  describe("Payment Terms and Currencies", () => {
    it("provides standard Net payment terms", () => {
      expect(PAYMENT_TERMS_OPTIONS).toContain("Due on Receipt");
      expect(PAYMENT_TERMS_OPTIONS).toContain("Net 15");
      expect(PAYMENT_TERMS_OPTIONS).toContain("Net 30");
      expect(PAYMENT_TERMS_OPTIONS).toContain("Net 60");
      expect(PAYMENT_TERMS_OPTIONS).toContain("Net 90");
    });

    it("provides key global currencies", () => {
      const currencyCodes = CURRENCY_OPTIONS.map((c) => c.value);
      expect(currencyCodes).toContain("USD");
      expect(currencyCodes).toContain("EUR");
      expect(currencyCodes).toContain("GBP");
    });
  });
});
