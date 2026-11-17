/**
 * Builds the request bodies for pricing and posting a sale. Nothing here does money arithmetic: amounts pass
 * through as the decimal text the cashier typed, and the server prices, checks and rounds them.
 */
import { LiveApiError, type TenderMethod } from "../../lib/live-api";

export interface LineForm {
  itemCode: string;
  description: string;
  qty: string;
  unitPrice: string;
  discount: string;
  taxRateBps: string;
  taxMode: "EXCLUSIVE" | "INCLUSIVE";
  revenueAccount: string;
  tracked: boolean;
}

export interface TenderForm {
  method: TenderMethod;
  amount: string;
}

export interface DiscountForm {
  amount: string;
  reason: string;
  approvalId: string;
}

export function emptyLine(): LineForm {
  return {
    itemCode: "",
    description: "",
    qty: "1",
    unitPrice: "",
    discount: "",
    taxRateBps: "1900",
    taxMode: "EXCLUSIVE",
    revenueAccount: "4000",
    tracked: true,
  };
}

export function emptyTender(method: TenderMethod = "CASH"): TenderForm {
  return { method, amount: "" };
}

export function emptyDiscount(): DiscountForm {
  return { amount: "", reason: "", approvalId: "" };
}

export function lineBody(line: LineForm): Record<string, unknown> {
  return {
    itemCode: line.itemCode.trim(),
    description: line.description.trim(),
    qty: line.qty.trim(),
    unitPrice: line.unitPrice.trim(),
    ...(line.discount.trim() === "" ? {} : { discount: line.discount.trim() }),
    taxRateBps: line.taxRateBps.trim(),
    taxMode: line.taxMode,
    revenueAccount: line.revenueAccount.trim(),
    tracked: line.tracked,
  };
}

export function tenderBody(tender: TenderForm): { method: TenderMethod; amount: string } {
  return { method: tender.method, amount: tender.amount.trim() };
}

/** A bill discount is sent only when an amount is typed. The reason is required by the server, so it is passed as typed. */
export function discountBody(discount: DiscountForm): Record<string, unknown> | undefined {
  if (discount.amount.trim() === "") return undefined;
  return {
    amount: discount.amount.trim(),
    reason: discount.reason.trim(),
    ...(discount.approvalId.trim() === "" ? {} : { approvalId: discount.approvalId.trim() }),
  };
}

export function priceBody(input: {
  companyId: string;
  warehouse: string;
  date: string;
  currency: string;
  lines: LineForm[];
  tenders: TenderForm[];
  discount: DiscountForm;
  discountApprovalAbove: string;
}): Record<string, unknown> {
  const discount = discountBody(input.discount);
  return {
    companyId: input.companyId,
    warehouse: input.warehouse.trim(),
    date: input.date,
    currency: input.currency,
    lines: input.lines.map(lineBody),
    tenders: input.tenders.filter((tender) => tender.amount.trim() !== "").map(tenderBody),
    ...(discount ? { billDiscount: discount } : {}),
    ...(input.discountApprovalAbove.trim() === "" ? {} : { discountApprovalAbove: input.discountApprovalAbove.trim() }),
  };
}

/** One sale, as the sync endpoint takes it. The id is made once per sale, so a retry is recognised as the same sale. */
export function saleBody(input: {
  id: string;
  warehouse: string;
  date: string;
  currency: string;
  lines: LineForm[];
  tenders: TenderForm[];
  discount: DiscountForm;
}): Record<string, unknown> {
  const discount = discountBody(input.discount);
  return {
    id: input.id,
    warehouse: input.warehouse.trim(),
    date: input.date,
    currency: input.currency,
    lines: input.lines.map(lineBody),
    tenders: input.tenders.filter((tender) => tender.amount.trim() !== "").map(tenderBody),
    ...(discount ? { billDiscount: discount } : {}),
  };
}

/** True when the server could not be reached at all, so the sale should be kept on this device. */
export function isNetworkFailure(error: unknown): boolean {
  return error instanceof LiveApiError && error.status === 0;
}

/** A sale id made on the device: a random UUID version 4. */
export function newSaleId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] ?? 0) & 0x0f | 0x40;
  bytes[8] = (bytes[8] ?? 0) & 0x3f | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
