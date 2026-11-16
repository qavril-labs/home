import { DomainError, newId } from "@erp/kernel";

/** A party is one record for a customer, a supplier, or both (MDM-01). */
export const PARTY_KINDS = ["CUSTOMER", "SUPPLIER", "BOTH"] as const;
export type PartyKind = (typeof PARTY_KINDS)[number];

export interface PartyInput {
  readonly kind: PartyKind;
  readonly name: string;
  /** Tax identification number. Unique within a company when given. */
  readonly taxId?: string | null;
  readonly email?: string | null;
  /** Default currency for documents with this party. ISO 4217, three letters. */
  readonly currency?: string | null;
}

export interface Party extends PartyInput {
  readonly id: string;
  readonly companyId: string;
  readonly active: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Checks a party and returns it in the stored form. Throws DomainError on invalid input. */
export function validateParty(input: PartyInput): PartyInput {
  if (!PARTY_KINDS.includes(input.kind)) {
    throw new DomainError("VALIDATION", "Party kind must be CUSTOMER, SUPPLIER or BOTH");
  }
  const name = input.name.trim();
  if (name.length < 1 || name.length > 160) {
    throw new DomainError("VALIDATION", "Party name must be 1 to 160 characters");
  }
  const taxId = input.taxId?.trim() || null;
  if (taxId !== null && (taxId.length > 40 || !/^[A-Za-z0-9-]+$/.test(taxId))) {
    throw new DomainError("VALIDATION", "Tax ID may use letters, digits and hyphens, up to 40 characters");
  }
  const email = input.email?.trim() || null;
  if (email !== null && (email.length > 254 || !EMAIL.test(email))) {
    throw new DomainError("VALIDATION", "Party email is not valid");
  }
  const currency = input.currency?.trim().toUpperCase() || null;
  if (currency !== null && !/^[A-Z]{3}$/.test(currency)) {
    throw new DomainError("VALIDATION", "Currency must be a three-letter ISO code");
  }
  return { kind: input.kind, name, taxId, email, currency };
}

export interface PartyStore {
  get(companyId: string, id: string): Promise<Party | undefined>;
  findByTaxId(companyId: string, taxId: string): Promise<Party | undefined>;
  save(party: Party): Promise<void>;
  list(companyId: string): Promise<Party[]>;
}

/** Creates a party in a company, refusing a duplicate tax ID. */
export async function createParty(store: PartyStore, companyId: string, input: PartyInput): Promise<Party> {
  const valid = validateParty(input);
  if (valid.taxId && (await store.findByTaxId(companyId, valid.taxId))) {
    throw new DomainError("CONFLICT", `A party with tax ID ${valid.taxId} already exists`);
  }
  const party: Party = { ...valid, id: newId(), companyId, active: true };
  await store.save(party);
  return party;
}

/** Deactivates a party. Documents that already refer to it keep working; new ones are refused. */
export async function deactivateParty(store: PartyStore, companyId: string, id: string): Promise<Party> {
  const party = await store.get(companyId, id);
  if (!party) throw new DomainError("NOT_FOUND", "Party not found");
  const updated = { ...party, active: false };
  await store.save(updated);
  return updated;
}

/** Memory store for tests and single-process use. */
export class MemoryPartyStore implements PartyStore {
  private readonly parties = new Map<string, Party>();

  async get(companyId: string, id: string): Promise<Party | undefined> {
    const party = this.parties.get(id);
    return party?.companyId === companyId ? party : undefined;
  }

  async findByTaxId(companyId: string, taxId: string): Promise<Party | undefined> {
    return [...this.parties.values()].find((party) => party.companyId === companyId && party.taxId === taxId);
  }

  async save(party: Party): Promise<void> {
    this.parties.set(party.id, party);
  }

  async list(companyId: string): Promise<Party[]> {
    return [...this.parties.values()].filter((party) => party.companyId === companyId).sort((a, b) => a.name.localeCompare(b.name));
  }
}
