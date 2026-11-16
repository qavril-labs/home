import { DomainError } from "@erp/kernel";

/** An item is a product or service the company buys or sells (MDM-02). */
export interface ItemInput {
  /** Unique within a company. Letters, digits, hyphens and dots. */
  readonly code: string;
  readonly name: string;
  /** Unit of measure, for example EA, KG, HR. */
  readonly unit: string;
  /** Income account used when the item is sold, for example 4000. */
  readonly revenueAccount?: string | null;
}

export interface Item extends ItemInput {
  readonly companyId: string;
  readonly active: boolean;
}

/** Checks an item and returns it in the stored form. Throws DomainError on invalid input. */
export function validateItem(input: ItemInput): ItemInput {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9.-]{0,39}$/.test(code)) {
    throw new DomainError("VALIDATION", "Item code may use letters, digits, dots and hyphens, up to 40 characters");
  }
  const name = input.name.trim();
  if (name.length < 1 || name.length > 160) {
    throw new DomainError("VALIDATION", "Item name must be 1 to 160 characters");
  }
  const unit = input.unit.trim().toUpperCase();
  if (!/^[A-Z]{1,10}$/.test(unit)) {
    throw new DomainError("VALIDATION", "Unit must be 1 to 10 letters, for example EA or KG");
  }
  const revenueAccount = input.revenueAccount?.trim() || null;
  if (revenueAccount !== null && !/^[0-9A-Za-z.-]{1,20}$/.test(revenueAccount)) {
    throw new DomainError("VALIDATION", "Revenue account code is not valid");
  }
  return { code, name, unit, revenueAccount };
}

export interface ItemStore {
  get(companyId: string, code: string): Promise<Item | undefined>;
  save(item: Item): Promise<void>;
  list(companyId: string): Promise<Item[]>;
}

/** Creates an item, refusing a code that already exists in the company. */
export async function createItem(store: ItemStore, companyId: string, input: ItemInput): Promise<Item> {
  const valid = validateItem(input);
  if (await store.get(companyId, valid.code)) {
    throw new DomainError("CONFLICT", `Item ${valid.code} already exists`);
  }
  const item: Item = { ...valid, companyId, active: true };
  await store.save(item);
  return item;
}

export class MemoryItemStore implements ItemStore {
  private readonly items = new Map<string, Item>();

  async get(companyId: string, code: string): Promise<Item | undefined> {
    return this.items.get(`${companyId}|${code}`);
  }

  async save(item: Item): Promise<void> {
    this.items.set(`${item.companyId}|${item.code}`, item);
  }

  async list(companyId: string): Promise<Item[]> {
    return [...this.items.values()].filter((item) => item.companyId === companyId).sort((a, b) => a.code.localeCompare(b.code));
  }
}
