import type { PartyAddress, PartyStatus, PartyType, PaymentTerms } from "../../types";

export const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD ($) · US Dollar" },
  { value: "EUR", label: "EUR (€) · Euro" },
  { value: "GBP", label: "GBP (£) · British Pound" },
  { value: "CAD", label: "CAD ($) · Canadian Dollar" },
  { value: "AUD", label: "AUD ($) · Australian Dollar" },
  { value: "INR", label: "INR (₹) · Indian Rupee" },
] as const;

export const PAYMENT_TERMS_OPTIONS: readonly PaymentTerms[] = [
  "Due on Receipt",
  "Net 15",
  "Net 30",
  "Net 60",
  "Net 90",
] as const;

export type PartyFieldKey =
  | "legalName"
  | "taxRegistrationNumber"
  | "contactPerson"
  | "email"
  | "phone"
  | "billingLine1"
  | "billingCity"
  | "billingPostalCode"
  | "billingCountry"
  | "shippingLine1"
  | "shippingCity"
  | "shippingPostalCode"
  | "shippingCountry";

export type PartyFormErrors = Partial<Record<PartyFieldKey, string>>;

export interface PartyFormInput {
  type: PartyType;
  legalName: string;
  tradeName: string;
  taxRegistrationNumber: string;
  contactPerson: string;
  email: string;
  phone: string;
  currency: string;
  paymentTerms: PaymentTerms;
  status: PartyStatus;
  billingAddress: PartyAddress;
  shippingAddress: PartyAddress;
  sameAsBilling: boolean;
}

export const EMPTY_ADDRESS: PartyAddress = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TAX_ID_PATTERN = /^[A-Z0-9][A-Z0-9\s-]{3,23}[A-Z0-9]$/;
const PHONE_PATTERN = /^[+\d\s().-]{7,25}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isValidTaxRegistrationNumber(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  if (!TAX_ID_PATTERN.test(normalized)) return false;
  const alphanumericOnly = normalized.replace(/[^A-Z0-9]/g, "");
  return alphanumericOnly.length >= 5 && /\d/.test(alphanumericOnly);
}

export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!PHONE_PATTERN.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 6;
}

export function validatePartyForm(form: PartyFormInput): PartyFormErrors {
  const errors: PartyFormErrors = {};

  if (!form.legalName.trim()) {
    errors.legalName = "Legal name is required.";
  }

  const taxId = form.taxRegistrationNumber.trim();
  if (!taxId) {
    errors.taxRegistrationNumber = "Tax registration number / VAT ID is required.";
  } else if (!isValidTaxRegistrationNumber(taxId)) {
    errors.taxRegistrationNumber =
      "Enter a valid Tax ID / VAT number (5–25 letters or numbers, e.g. US-8492019).";
  }

  if (!form.contactPerson.trim()) {
    errors.contactPerson = "Contact person is required.";
  }

  const email = form.email.trim();
  if (!email) {
    errors.email = "Email address is required.";
  } else if (!isValidEmail(email)) {
    errors.email = "Enter a valid email address (e.g. billing@company.com).";
  }

  if (!isValidPhone(form.phone)) {
    errors.phone = "Enter a valid phone number or leave it blank.";
  }

  if (!form.billingAddress.line1.trim()) {
    errors.billingLine1 = "Billing street address is required.";
  }
  if (!form.billingAddress.city.trim()) {
    errors.billingCity = "Billing city is required.";
  }
  if (!form.billingAddress.postalCode.trim()) {
    errors.billingPostalCode = "Billing postal code is required.";
  }
  if (!form.billingAddress.country.trim()) {
    errors.billingCountry = "Billing country is required.";
  }

  if (!form.sameAsBilling) {
    if (!form.shippingAddress.line1.trim()) {
      errors.shippingLine1 = "Shipping street address is required.";
    }
    if (!form.shippingAddress.city.trim()) {
      errors.shippingCity = "Shipping city is required.";
    }
    if (!form.shippingAddress.postalCode.trim()) {
      errors.shippingPostalCode = "Shipping postal code is required.";
    }
    if (!form.shippingAddress.country.trim()) {
      errors.shippingCountry = "Shipping country is required.";
    }
  }

  return errors;
}

export function addressesEqual(a: PartyAddress, b: PartyAddress): boolean {
  return (
    a.line1.trim() === b.line1.trim() &&
    (a.line2 ?? "").trim() === (b.line2 ?? "").trim() &&
    a.city.trim() === b.city.trim() &&
    a.state.trim() === b.state.trim() &&
    a.postalCode.trim() === b.postalCode.trim() &&
    a.country.trim() === b.country.trim()
  );
}
