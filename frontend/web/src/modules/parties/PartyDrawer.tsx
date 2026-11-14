import React, { useEffect, useState } from "react";
import { Drawer } from "../../components/ui/Drawer";
import type {
  Party,
  PartyAddress,
  PartyStatus,
  PartyType,
  PaymentTerms,
} from "../../types";
import { AlertCircle, ArrowLeftRight, Building2, Truck } from "lucide-react";

export interface PartyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editingParty?: Party | null;
  defaultType?: PartyType;
  onSave: (party: Party) => void;
}

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

const EMPTY_ADDRESS: PartyAddress = {
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

function addressesEqual(a: PartyAddress, b: PartyAddress): boolean {
  return (
    a.line1.trim() === b.line1.trim() &&
    (a.line2 ?? "").trim() === (b.line2 ?? "").trim() &&
    a.city.trim() === b.city.trim() &&
    a.state.trim() === b.state.trim() &&
    a.postalCode.trim() === b.postalCode.trim() &&
    a.country.trim() === b.country.trim()
  );
}

function cleanAddress(address: PartyAddress): PartyAddress {
  const line2 = address.line2?.trim();
  return {
    line1: address.line1.trim(),
    ...(line2 ? { line2 } : {}),
    city: address.city.trim(),
    state: address.state.trim(),
    postalCode: address.postalCode.trim(),
    country: address.country.trim(),
  };
}

export const PartyDrawer: React.FC<PartyDrawerProps> = ({
  isOpen,
  onClose,
  editingParty,
  defaultType = "customer",
  onSave,
}) => {
  const [partyType, setPartyType] = useState<PartyType>(defaultType);
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [taxRegistrationNumber, setTaxRegistrationNumber] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>("Net 30");
  const [status, setStatus] = useState<PartyStatus>("active");
  const [billingAddress, setBillingAddress] = useState<PartyAddress>({ ...EMPTY_ADDRESS });
  const [shippingAddress, setShippingAddress] = useState<PartyAddress>({ ...EMPTY_ADDRESS });
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [errors, setErrors] = useState<PartyFormErrors>({});
  const [showValidationBanner, setShowValidationBanner] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    setShowValidationBanner(false);

    if (editingParty) {
      const nextBilling: PartyAddress = {
        line1: editingParty.billingAddress.line1,
        line2: editingParty.billingAddress.line2 ?? "",
        city: editingParty.billingAddress.city,
        state: editingParty.billingAddress.state,
        postalCode: editingParty.billingAddress.postalCode,
        country: editingParty.billingAddress.country,
      };
      const nextShipping: PartyAddress = {
        line1: editingParty.shippingAddress.line1,
        line2: editingParty.shippingAddress.line2 ?? "",
        city: editingParty.shippingAddress.city,
        state: editingParty.shippingAddress.state,
        postalCode: editingParty.shippingAddress.postalCode,
        country: editingParty.shippingAddress.country,
      };
      const inferredSame =
        editingParty.sameAsBilling ?? addressesEqual(nextBilling, nextShipping);

      setPartyType(editingParty.type);
      setLegalName(editingParty.legalName);
      setTradeName(editingParty.tradeName);
      setTaxRegistrationNumber(editingParty.taxRegistrationNumber);
      setContactPerson(editingParty.contactPerson);
      setEmail(editingParty.email);
      setPhone(editingParty.phone ?? "");
      setCurrency(editingParty.currency || "USD");
      setPaymentTerms(editingParty.paymentTerms || "Net 30");
      setStatus(editingParty.status || "active");
      setBillingAddress(nextBilling);
      setShippingAddress(nextShipping);
      setSameAsBilling(inferredSame);
    } else {
      setPartyType(defaultType);
      setLegalName("");
      setTradeName("");
      setTaxRegistrationNumber("");
      setContactPerson("");
      setEmail("");
      setPhone("");
      setCurrency("USD");
      setPaymentTerms("Net 30");
      setStatus("active");
      setBillingAddress({ ...EMPTY_ADDRESS });
      setShippingAddress({ ...EMPTY_ADDRESS });
      setSameAsBilling(true);
    }
  }, [isOpen, editingParty, defaultType]);

  const clearFieldError = (key: PartyFieldKey) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      if (Object.keys(next).length === 0) {
        setShowValidationBanner(false);
      }
      return next;
    });
  };

  const updateBilling = (field: keyof PartyAddress, value: string, errorKey?: PartyFieldKey) => {
    setBillingAddress((prev) => ({ ...prev, [field]: value }));
    if (errorKey) clearFieldError(errorKey);
  };

  const updateShipping = (field: keyof PartyAddress, value: string, errorKey?: PartyFieldKey) => {
    setShippingAddress((prev) => ({ ...prev, [field]: value }));
    if (errorKey) clearFieldError(errorKey);
  };

  const handleToggleSameAsBilling = (checked: boolean) => {
    setSameAsBilling(checked);
    if (checked) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.shippingLine1;
        delete next.shippingCity;
        delete next.shippingPostalCode;
        delete next.shippingCountry;
        if (Object.keys(next).length === 0) {
          setShowValidationBanner(false);
        }
        return next;
      });
    }
  };

  const handleSubmit = () => {
    const validationErrors = validatePartyForm({
      type: partyType,
      legalName,
      tradeName,
      taxRegistrationNumber,
      contactPerson,
      email,
      phone,
      currency,
      paymentTerms,
      status,
      billingAddress,
      shippingAddress,
      sameAsBilling,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setShowValidationBanner(true);
      return;
    }

    const cleanedBilling = cleanAddress(billingAddress);
    const cleanedShipping = sameAsBilling
      ? { ...cleanedBilling }
      : cleanAddress(shippingAddress);
    const trimmedPhone = phone.trim();

    const savedParty: Party = {
      id: editingParty?.id || `PTY-${Date.now().toString().slice(-4)}`,
      type: partyType,
      legalName: legalName.trim(),
      tradeName: tradeName.trim(),
      taxRegistrationNumber: taxRegistrationNumber.trim().toUpperCase(),
      contactPerson: contactPerson.trim(),
      email: email.trim(),
      ...(trimmedPhone ? { phone: trimmedPhone } : {}),
      currency,
      paymentTerms,
      billingAddress: cleanedBilling,
      shippingAddress: cleanedShipping,
      sameAsBilling,
      // Zero money math in the browser: preserve existing decimal string or initialize to "0.00"
      outstandingBalance: editingParty ? editingParty.outstandingBalance : "0.00",
      status,
    };

    onSave(savedParty);
    onClose();
  };

  const errorCount = Object.keys(errors).length;

  const inputBaseClass = (hasError?: string) =>
    `w-full px-3 py-2 text-sm font-bold bg-page text-text border-line shadow-sm focus:outline-none focus:ring-2 placeholder:text-muted ${
      hasError ? "border-act focus:ring-act" : "focus:ring-lime"
    }`;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={editingParty ? "Edit customer or supplier" : "New customer or supplier"}
      description="Party Master (MDM-01). Balances update only when entries are posted."
      primaryActionLabel={editingParty ? "Save party" : "Create party"}
      primaryActionVariant="lime"
      onPrimaryAction={handleSubmit}
      secondaryActionLabel="Cancel"
    >
      <div className="space-y-4">
        {showValidationBanner && errorCount > 0 && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2.5 p-3 bg-page border-line border-act text-act text-xs font-bold shadow-sm"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p>
                Please fix the {errorCount === 1 ? "highlighted field" : `${errorCount} highlighted fields`} before saving.
              </p>
            </div>
          </div>
        )}

        {/* Party Type */}
        <div>
          <span className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
            Party Type *
          </span>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Party Type">
            {(
              [
                { id: "customer", label: "Customer", icon: Building2 },
                { id: "supplier", label: "Supplier", icon: Truck },
                { id: "both", label: "Both", icon: ArrowLeftRight },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const active = partyType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPartyType(opt.id)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold border-line transition-all cursor-pointer ${
                    active
                      ? "bg-lime text-ink shadow-sm -translate-y-0.5"
                      : "bg-page text-muted hover:text-text"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Legal Name & Trade Name */}
        <div>
          <label
            htmlFor="party-legal-name"
            className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
          >
            Legal Name *
          </label>
          <input
            id="party-legal-name"
            type="text"
            required
            value={legalName}
            aria-invalid={Boolean(errors.legalName)}
            aria-describedby={errors.legalName ? "party-legal-name-error" : undefined}
            onChange={(e) => {
              setLegalName(e.target.value);
              clearFieldError("legalName");
            }}
            placeholder="e.g. Delta Dynamics Manufacturing LLC"
            className={inputBaseClass(errors.legalName)}
          />
          {errors.legalName && (
            <p id="party-legal-name-error" role="alert" className="mt-1 text-xs font-bold text-act">
              {errors.legalName}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 min-[520px]:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="party-trade-name"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Trade Name
            </label>
            <input
              id="party-trade-name"
              type="text"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
              placeholder="e.g. Delta Dynamics"
              className={inputBaseClass()}
            />
          </div>

          <div>
            <label
              htmlFor="party-tax-id"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Tax Registration / VAT ID *
            </label>
            <input
              id="party-tax-id"
              type="text"
              required
              value={taxRegistrationNumber}
              aria-invalid={Boolean(errors.taxRegistrationNumber)}
              aria-describedby={errors.taxRegistrationNumber ? "party-tax-id-error" : undefined}
              onChange={(e) => {
                setTaxRegistrationNumber(e.target.value);
                clearFieldError("taxRegistrationNumber");
              }}
              placeholder="e.g. US-8492019"
              className={`${inputBaseClass(errors.taxRegistrationNumber)} font-mono uppercase`}
            />
            {errors.taxRegistrationNumber && (
              <p id="party-tax-id-error" role="alert" className="mt-1 text-xs font-bold text-act">
                {errors.taxRegistrationNumber}
              </p>
            )}
          </div>
        </div>

        {/* Contact Person, Email, Phone */}
        <div>
          <label
            htmlFor="party-contact-person"
            className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
          >
            Contact Person *
          </label>
          <input
            id="party-contact-person"
            type="text"
            required
            value={contactPerson}
            aria-invalid={Boolean(errors.contactPerson)}
            aria-describedby={errors.contactPerson ? "party-contact-person-error" : undefined}
            onChange={(e) => {
              setContactPerson(e.target.value);
              clearFieldError("contactPerson");
            }}
            placeholder="e.g. Elena Vance"
            className={inputBaseClass(errors.contactPerson)}
          />
          {errors.contactPerson && (
            <p id="party-contact-person-error" role="alert" className="mt-1 text-xs font-bold text-act">
              {errors.contactPerson}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 min-[520px]:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="party-email"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Email *
            </label>
            <input
              id="party-email"
              type="email"
              required
              value={email}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "party-email-error" : undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError("email");
              }}
              placeholder="billing@company.com"
              className={inputBaseClass(errors.email)}
            />
            {errors.email && (
              <p id="party-email-error" role="alert" className="mt-1 text-xs font-bold text-act">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="party-phone"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Phone
            </label>
            <input
              id="party-phone"
              type="tel"
              value={phone}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? "party-phone-error" : undefined}
              onChange={(e) => {
                setPhone(e.target.value);
                clearFieldError("phone");
              }}
              placeholder="+1 555-019-2831"
              className={inputBaseClass(errors.phone)}
            />
            {errors.phone && (
              <p id="party-phone-error" role="alert" className="mt-1 text-xs font-bold text-act">
                {errors.phone}
              </p>
            )}
          </div>
        </div>

        {/* Currency & Payment Terms */}
        <div className="grid grid-cols-1 min-[520px]:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="party-currency"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Currency
            </label>
            <select
              id="party-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={inputBaseClass()}
            >
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="party-payment-terms"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Payment Terms
            </label>
            <select
              id="party-payment-terms"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value as PaymentTerms)}
              className={inputBaseClass()}
            >
              {PAYMENT_TERMS_OPTIONS.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status */}
        <div>
          <span className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
            Status
          </span>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Party Status">
            {(
              [
                { id: "active", label: "Active" },
                { id: "inactive", label: "Inactive" },
              ] as const
            ).map((opt) => {
              const active = status === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatus(opt.id)}
                  className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold border-line transition-all cursor-pointer ${
                    active
                      ? opt.id === "active"
                        ? "bg-lime text-ink shadow-sm -translate-y-0.5"
                        : "bg-cream text-ink shadow-sm -translate-y-0.5"
                      : "bg-page text-muted hover:text-text"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`w-2 h-2 rounded-full border border-ink ${
                      opt.id === "active" ? "bg-good" : "bg-idle"
                    }`}
                  />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Billing Address */}
        <fieldset className="p-3 bg-page border-line shadow-sm space-y-3">
          <legend className="px-1.5 text-xs font-bold uppercase tracking-wider text-text">
            Billing Address
          </legend>

          <div>
            <label
              htmlFor="party-billing-line1"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Address Line 1 *
            </label>
            <input
              id="party-billing-line1"
              type="text"
              required
              value={billingAddress.line1}
              aria-invalid={Boolean(errors.billingLine1)}
              aria-describedby={errors.billingLine1 ? "party-billing-line1-error" : undefined}
              onChange={(e) => updateBilling("line1", e.target.value, "billingLine1")}
              placeholder="Street address or PO box"
              className={inputBaseClass(errors.billingLine1)}
            />
            {errors.billingLine1 && (
              <p id="party-billing-line1-error" role="alert" className="mt-1 text-xs font-bold text-act">
                {errors.billingLine1}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="party-billing-line2"
              className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
            >
              Address Line 2
            </label>
            <input
              id="party-billing-line2"
              type="text"
              value={billingAddress.line2 ?? ""}
              onChange={(e) => updateBilling("line2", e.target.value)}
              placeholder="Suite, unit, building (optional)"
              className={inputBaseClass()}
            />
          </div>

          <div className="grid grid-cols-1 min-[520px]:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="party-billing-city"
                className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
              >
                City *
              </label>
              <input
                id="party-billing-city"
                type="text"
                required
                value={billingAddress.city}
                aria-invalid={Boolean(errors.billingCity)}
                aria-describedby={errors.billingCity ? "party-billing-city-error" : undefined}
                onChange={(e) => updateBilling("city", e.target.value, "billingCity")}
                placeholder="City"
                className={inputBaseClass(errors.billingCity)}
              />
              {errors.billingCity && (
                <p id="party-billing-city-error" role="alert" className="mt-1 text-xs font-bold text-act">
                  {errors.billingCity}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="party-billing-state"
                className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
              >
                State / Province
              </label>
              <input
                id="party-billing-state"
                type="text"
                value={billingAddress.state}
                onChange={(e) => updateBilling("state", e.target.value)}
                placeholder="State or province"
                className={inputBaseClass()}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 min-[520px]:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="party-billing-postal"
                className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
              >
                Postal Code *
              </label>
              <input
                id="party-billing-postal"
                type="text"
                required
                value={billingAddress.postalCode}
                aria-invalid={Boolean(errors.billingPostalCode)}
                aria-describedby={errors.billingPostalCode ? "party-billing-postal-error" : undefined}
                onChange={(e) => updateBilling("postalCode", e.target.value, "billingPostalCode")}
                placeholder="Postal / ZIP code"
                className={inputBaseClass(errors.billingPostalCode)}
              />
              {errors.billingPostalCode && (
                <p id="party-billing-postal-error" role="alert" className="mt-1 text-xs font-bold text-act">
                  {errors.billingPostalCode}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="party-billing-country"
                className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
              >
                Country *
              </label>
              <input
                id="party-billing-country"
                type="text"
                required
                value={billingAddress.country}
                aria-invalid={Boolean(errors.billingCountry)}
                aria-describedby={errors.billingCountry ? "party-billing-country-error" : undefined}
                onChange={(e) => updateBilling("country", e.target.value, "billingCountry")}
                placeholder="Country"
                className={inputBaseClass(errors.billingCountry)}
              />
              {errors.billingCountry && (
                <p id="party-billing-country-error" role="alert" className="mt-1 text-xs font-bold text-act">
                  {errors.billingCountry}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        {/* Shipping Address */}
        <fieldset className="p-3 bg-page border-line shadow-sm space-y-3">
          <legend className="px-1.5 text-xs font-bold uppercase tracking-wider text-text">
            Shipping Address
          </legend>

          <label
            htmlFor="party-same-as-billing"
            className="flex items-center gap-2.5 text-sm font-bold text-text cursor-pointer select-none"
          >
            <input
              id="party-same-as-billing"
              type="checkbox"
              checked={sameAsBilling}
              onChange={(e) => handleToggleSameAsBilling(e.target.checked)}
              className="w-4 h-4 accent-ink border-line cursor-pointer"
            />
            <span>Same as billing address</span>
          </label>

          {sameAsBilling ? (
            <p className="text-xs text-muted">
              Deliveries will use the billing address above.
            </p>
          ) : (
            <div className="space-y-3 pt-1">
              <div>
                <label
                  htmlFor="party-shipping-line1"
                  className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
                >
                  Address Line 1 *
                </label>
                <input
                  id="party-shipping-line1"
                  type="text"
                  required
                  value={shippingAddress.line1}
                  aria-invalid={Boolean(errors.shippingLine1)}
                  aria-describedby={errors.shippingLine1 ? "party-shipping-line1-error" : undefined}
                  onChange={(e) => updateShipping("line1", e.target.value, "shippingLine1")}
                  placeholder="Delivery street address"
                  className={inputBaseClass(errors.shippingLine1)}
                />
                {errors.shippingLine1 && (
                  <p id="party-shipping-line1-error" role="alert" className="mt-1 text-xs font-bold text-act">
                    {errors.shippingLine1}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="party-shipping-line2"
                  className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
                >
                  Address Line 2
                </label>
                <input
                  id="party-shipping-line2"
                  type="text"
                  value={shippingAddress.line2 ?? ""}
                  onChange={(e) => updateShipping("line2", e.target.value)}
                  placeholder="Dock, warehouse, gate (optional)"
                  className={inputBaseClass()}
                />
              </div>

              <div className="grid grid-cols-1 min-[520px]:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="party-shipping-city"
                    className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
                  >
                    City *
                  </label>
                  <input
                    id="party-shipping-city"
                    type="text"
                    required
                    value={shippingAddress.city}
                    aria-invalid={Boolean(errors.shippingCity)}
                    aria-describedby={errors.shippingCity ? "party-shipping-city-error" : undefined}
                    onChange={(e) => updateShipping("city", e.target.value, "shippingCity")}
                    placeholder="City"
                    className={inputBaseClass(errors.shippingCity)}
                  />
                  {errors.shippingCity && (
                    <p id="party-shipping-city-error" role="alert" className="mt-1 text-xs font-bold text-act">
                      {errors.shippingCity}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="party-shipping-state"
                    className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
                  >
                    State / Province
                  </label>
                  <input
                    id="party-shipping-state"
                    type="text"
                    value={shippingAddress.state}
                    onChange={(e) => updateShipping("state", e.target.value)}
                    placeholder="State or province"
                    className={inputBaseClass()}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 min-[520px]:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="party-shipping-postal"
                    className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
                  >
                    Postal Code *
                  </label>
                  <input
                    id="party-shipping-postal"
                    type="text"
                    required
                    value={shippingAddress.postalCode}
                    aria-invalid={Boolean(errors.shippingPostalCode)}
                    aria-describedby={errors.shippingPostalCode ? "party-shipping-postal-error" : undefined}
                    onChange={(e) => updateShipping("postalCode", e.target.value, "shippingPostalCode")}
                    placeholder="Postal / ZIP code"
                    className={inputBaseClass(errors.shippingPostalCode)}
                  />
                  {errors.shippingPostalCode && (
                    <p id="party-shipping-postal-error" role="alert" className="mt-1 text-xs font-bold text-act">
                      {errors.shippingPostalCode}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="party-shipping-country"
                    className="block text-xs font-bold uppercase tracking-wider text-muted mb-1"
                  >
                    Country *
                  </label>
                  <input
                    id="party-shipping-country"
                    type="text"
                    required
                    value={shippingAddress.country}
                    aria-invalid={Boolean(errors.shippingCountry)}
                    aria-describedby={errors.shippingCountry ? "party-shipping-country-error" : undefined}
                    onChange={(e) => updateShipping("country", e.target.value, "shippingCountry")}
                    placeholder="Country"
                    className={inputBaseClass(errors.shippingCountry)}
                  />
                  {errors.shippingCountry && (
                    <p id="party-shipping-country-error" role="alert" className="mt-1 text-xs font-bold text-act">
                      {errors.shippingCountry}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </fieldset>
      </div>
    </Drawer>
  );
};
