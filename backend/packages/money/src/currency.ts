import { DomainError } from "@erp/kernel";

export interface CurrencyInfo {
  readonly code: string;
  readonly minorUnits: number;
  readonly name: string;
}

/**
 * Subset of ISO 4217 for the first markets. Replace with a complete,
 * maintained table before onboarding customers in other countries.
 */
const CURRENCIES: readonly CurrencyInfo[] = [
  { code: "USD", minorUnits: 2, name: "US Dollar" },
  { code: "EUR", minorUnits: 2, name: "Euro" },
  { code: "GBP", minorUnits: 2, name: "Pound Sterling" },
  { code: "CHF", minorUnits: 2, name: "Swiss Franc" },
  { code: "CAD", minorUnits: 2, name: "Canadian Dollar" },
  { code: "AUD", minorUnits: 2, name: "Australian Dollar" },
  { code: "CNY", minorUnits: 2, name: "Yuan Renminbi" },
  { code: "JPY", minorUnits: 0, name: "Yen" },
  { code: "INR", minorUnits: 2, name: "Indian Rupee" },
  { code: "IDR", minorUnits: 2, name: "Rupiah" },
  { code: "SAR", minorUnits: 2, name: "Saudi Riyal" },
  { code: "AED", minorUnits: 2, name: "UAE Dirham" },
  { code: "KWD", minorUnits: 3, name: "Kuwaiti Dinar" },
  { code: "BHD", minorUnits: 3, name: "Bahraini Dinar" },
  { code: "OMR", minorUnits: 3, name: "Omani Rial" },
  { code: "JOD", minorUnits: 3, name: "Jordanian Dinar" },
  { code: "TND", minorUnits: 3, name: "Tunisian Dinar" },
  { code: "EGP", minorUnits: 2, name: "Egyptian Pound" },
  { code: "KES", minorUnits: 2, name: "Kenyan Shilling" },
  { code: "NGN", minorUnits: 2, name: "Naira" },
  { code: "GHS", minorUnits: 2, name: "Ghana Cedi" },
  { code: "ZAR", minorUnits: 2, name: "Rand" },
  { code: "MXN", minorUnits: 2, name: "Mexican Peso" },
  { code: "BRL", minorUnits: 2, name: "Brazilian Real" },
];

const BY_CODE = new Map(CURRENCIES.map((currency) => [currency.code, currency]));

export function getCurrency(code: string): CurrencyInfo {
  const info = BY_CODE.get(code);
  if (!info) {
    throw new DomainError("VALIDATION", `Unknown currency: ${code}`);
  }
  return info;
}

export function isKnownCurrency(code: string): boolean {
  return BY_CODE.has(code);
}
