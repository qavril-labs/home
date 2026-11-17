import { describe, expect, it } from "vitest";
import { DomainError, FixedClock, newId } from "@erp/kernel";
import { Inventory, InMemoryInventoryStore, type InventoryAccounts } from "@erp/inventory";
import { InMemoryLedgerStore, Ledger } from "@erp/ledger";
import { Money } from "@erp/money";
import { InMemoryCounterStore, NumberingService } from "@erp/numbering";
import { InMemoryPosStore, POS_SALE_SEQUENCE, PosRegister, priceSale, type SaleInput, type SaleLineInput } from "../src";

const COMPANY = "11111111-1111-7111-8111-111111111111";
const TENANT = "22222222-2222-7222-8222-222222222222";
const STOCK: InventoryAccounts = { inventory: "1300", clearing: "2050", cogs: "5000", writeOff: "5100", countVariance: "5200" };
const kes = (decimal: string) => Money.fromDecimal(decimal, "KES");

function line(overrides: Partial<SaleLineInput> = {}): SaleLineInput {
  return { itemCode: "PARA-500", description: "Paracetamol", qty: 1n, unitPrice: kes("100.00"), taxRateBps: 1900n, taxMode: "EXCLUSIVE", revenueAccount: "4000", tracked: false, ...overrides };
}

describe("bill-level discounts (DISC-001, TAX-001)", () => {
  it("shares the bill discount across lines in proportion to what each costs, and taxes what is left", () => {
    const sale = priceSale([line({ unitPrice: kes("100.00") }), line({ itemCode: "SOAP", unitPrice: kes("50.00") })], "KES", {
      billDiscount: kes("15.00"),
    });

    expect(sale.lines.map((item) => [item.billDiscount.toDecimal(), item.net.toDecimal(), item.tax.toDecimal(), item.total.toDecimal()])).toEqual([
      ["10.00", "90.00", "17.10", "107.10"],
      ["5.00", "45.00", "8.55", "53.55"],
    ]);
    expect(sale.billDiscount.toDecimal()).toBe("15.00");
    expect(sale.total.toDecimal()).toBe("160.65");
  });

  it("works with inclusive tax: the price is what the customer pays, and the tax inside it comes out of the discounted price", () => {
    const sale = priceSale([line({ unitPrice: kes("119.00"), taxMode: "INCLUSIVE" })], "KES", { billDiscount: kes("19.00") });

    expect(sale.total.toDecimal()).toBe("100.00");
    expect(sale.tax.toDecimal()).toBe("15.97");
    expect(sale.subtotal.toDecimal()).toBe("84.03");
  });

  it("refuses a bill discount larger than the bill", () => {
    expect(() => priceSale([line({ unitPrice: kes("10.00") })], "KES", { billDiscount: kes("10.01") })).toThrow(DomainError);
  });
});

async function setup() {
  const clock = new FixedClock(new Date("2026-03-01T09:00:00Z"));
  const ledger = new Ledger(new InMemoryLedgerStore(), COMPANY, "KES", clock);
  for (const [code, name, type] of [
    ["1000", "Cash", "ASSET"],
    ["1010", "Card clearing", "ASSET"],
    ["1300", "Stock on hand", "ASSET"],
    ["2050", "Goods received not invoiced", "LIABILITY"],
    ["2100", "Tax payable", "LIABILITY"],
    ["4000", "Sales", "REVENUE"],
    ["5000", "Cost of goods sold", "EXPENSE"],
    ["5100", "Expired stock written off", "EXPENSE"],
    ["5200", "Stock count variance", "EXPENSE"],
  ] as const) {
    await ledger.createAccount({ code, name, type });
  }
  const periods = await ledger.createFiscalYear(2026, 1);
  const inventory = new Inventory({ store: new InMemoryInventoryStore(), posting: { ledger, accounts: STOCK }, clock });
  const numbering = new NumberingService(new InMemoryCounterStore(), [{ key: POS_SALE_SEQUENCE, prefix: "POS-", padding: 6, reset: "YEARLY" }]);
  const store = new InMemoryPosStore();
  const register = new PosRegister({
    tenantId: TENANT,
    store,
    inventory,
    ledger,
    numbering,
    accounts: { tenders: { CASH: "1000", CARD: "1010", MOBILE: "1010" }, taxPayable: "2100" },
    clock,
    billDiscountApprovalAbove: kes("5.00"),
  });
  await inventory.receive({ companyId: COMPANY, warehouse: "COUNTER", item: "PARA-500", batchNo: "A", expiresOn: "2026-12-31", qty: 20n, unitCost: kes("2.50"), date: "2026-03-01", reference: "GRN-A" });
  return { ledger, inventory, register, store, periods };
}

function sale(overrides: Partial<SaleInput> = {}): SaleInput {
  return {
    id: newId(),
    companyId: COMPANY,
    warehouse: "COUNTER",
    date: "2026-03-05",
    currency: "KES",
    // Two units at 10.00 with 19% tax is 23.80, so the default payment is exact.
    lines: [line({ qty: 2n, unitPrice: kes("10.00"), tracked: true })],
    tenders: [{ method: "CASH", amount: kes("23.80") }],
    ...overrides,
  };
}

describe("bill discounts and review in the register", () => {
  it("keeps a discount with no reason for review, and moves no stock", async () => {
    const { inventory, register } = await setup();
    // A 1.00 discount on 20.00 of goods leaves 19.00, which with 19% tax is 22.61.
    const result = await register.record(sale({ billDiscount: { amount: kes("1.00"), reason: " " }, tenders: [{ method: "CASH", amount: kes("22.61") }] }));

    expect(result.sale).toMatchObject({ status: "NEEDS_REVIEW", reasons: ["DISCOUNT_REASON_MISSING"] });
    expect(await inventory.available(COMPANY, "COUNTER", "PARA-500", "2026-03-05")).toBe(20n);
  });

  it("a closed period sends the sale to review rather than rejecting it, and moves no stock and posts nothing", async () => {
    const { inventory, ledger, periods, register } = await setup();
    const march = periods.find((period) => period.startDate <= "2026-03-05" && "2026-03-05" <= period.endDate)!;
    await ledger.closePeriod(march.id);

    const result = await register.record(sale());

    expect(result.sale.status).toBe("NEEDS_REVIEW");
    expect(result.sale.reasons[0]).toMatch(/^PERIOD_CLOSED/);
    expect(await inventory.available(COMPANY, "COUNTER", "PARA-500", "2026-03-05")).toBe(20n);
    expect(await ledger.entryByReference(`POS-SALE/${result.sale.id}`)).toBeUndefined();
  });

  it("a reviewer posts a review sale on an open date, and the decision is kept beside the sale", async () => {
    const { ledger, periods, register } = await setup();
    const march = periods.find((period) => period.startDate <= "2026-03-05" && "2026-03-05" <= period.endDate)!;
    await ledger.closePeriod(march.id);
    const original = await register.record(sale());

    const reviewed = await register.review({ companyId: COMPANY, saleId: original.sale.id, decidedBy: "manager-1", decision: "POST", reason: "Posting to April instead.", date: "2026-04-02" });

    expect(reviewed.decision).toMatchObject({ decision: "POSTED", postedOn: "2026-04-02", decidedBy: "manager-1" });
    expect(reviewed.decision?.number).toMatch(/^POS-2026-/);
    expect((await ledger.entryByReference(`POS-SALE/${original.sale.id}`))?.date).toBe("2026-04-02");
    // The sale itself is unchanged; its resolution is what changed.
    expect(reviewed.sale.status).toBe("NEEDS_REVIEW");
    expect(reviewed.sale.resolution?.decision).toBe("POSTED");
  });

  it("a review that still cannot post changes nothing and says why", async () => {
    const { register } = await setup();
    const short = await register.record(sale({ tenders: [{ method: "CARD", amount: kes("1.00") }] }));

    const refused = await register.review({ companyId: COMPANY, saleId: short.sale.id, decidedBy: "manager-1", decision: "POST", reason: "Card total reconciled." });

    expect(refused.decision).toBeNull();
    expect(refused.reasons).toEqual(["PAYMENT_SHORT"]);
    expect(refused.sale.resolution).toBeNull();
  });

  it("a sale is decided once: a second decision is refused", async () => {
    const { register } = await setup();
    const short = await register.record(sale({ tenders: [{ method: "CARD", amount: kes("1.00") }] }));
    await register.review({ companyId: COMPANY, saleId: short.sale.id, decidedBy: "manager-1", decision: "VOID", reason: "Duplicate of another sale." });

    await expect(
      register.review({ companyId: COMPANY, saleId: short.sale.id, decidedBy: "manager-1", decision: "POST", reason: "Changed my mind.", tenders: [{ method: "CASH", amount: kes("11.90") }] }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("a bill discount above the threshold without an approver is kept for review, and is posted once an approver is recorded", async () => {
    const { register } = await setup();
    const id = newId();
    // A 10.00 discount on 20.00 of goods leaves 10.00, which with 19% tax is 11.90.
    const held = await register.record(sale({ id, billDiscount: { amount: kes("10.00"), reason: "Loyalty card" }, tenders: [{ method: "CASH", amount: kes("11.90") }] }));
    expect(held.sale.reasons).toEqual(["DISCOUNT_NEEDS_APPROVAL"]);

    const reviewed = await register.review({
      companyId: COMPANY,
      saleId: id,
      decidedBy: "manager-1",
      decision: "POST",
      reason: "Manager approved the loyalty discount.",
      billDiscountApprovedBy: "manager-1",
    });

    expect(reviewed.decision?.decision).toBe("POSTED");
  });
});
