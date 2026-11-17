import { DomainError } from "@erp/kernel";
import type { TaxCode } from "./tax";

/**
 * A country rule pack: the tax codes and rates for one country, as data (CLAUDE.md, architecture rule 5).
 * A pack is usable only after a named expert has reviewed it, so no unreviewed rule reaches an invoice.
 */
export interface RuleReview {
  /** The expert who reviewed the pack. A person's name or the reviewing firm, as agreed. */
  readonly reviewer: string;
  /** Qualification or licence the reviewer holds for this country, for the record. */
  readonly qualification: string;
  /** Date of review, YYYY-MM-DD. */
  readonly reviewedOn: string;
}

export interface RulePack {
  readonly country: string;
  readonly version: string;
  readonly status: "DRAFT" | "REVIEWED";
  readonly review?: RuleReview;
  readonly taxCodes: readonly TaxCode[];
}

const COUNTRY = /^[A-Z]{2}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Checks that a pack is complete and, if it is REVIEWED, that its review is on record. */
export function validateRulePack(pack: RulePack): RulePack {
  if (!COUNTRY.test(pack.country)) {
    throw new DomainError("VALIDATION", "A rule pack needs a two-letter ISO country code");
  }
  if (!VERSION.test(pack.version)) {
    throw new DomainError("VALIDATION", "A rule pack needs a version such as 1.0.0");
  }
  if (pack.status === "REVIEWED") {
    const review = pack.review;
    if (!review || !review.reviewer.trim() || !review.qualification.trim() || !DATE.test(review.reviewedOn)) {
      throw new DomainError("VALIDATION", `Rule pack ${pack.country} ${pack.version} is marked reviewed without a complete review record`);
    }
  }
  return pack;
}

/**
 * Splits packs into those that may be used and those that are refused. A draft, or a pack with no review,
 * is refused with the reason, so the books can show exactly which rules were not applied.
 */
export function usableRulePacks(packs: readonly RulePack[]): {
  readonly usable: readonly RulePack[];
  readonly refused: readonly { readonly country: string; readonly version: string; readonly reason: string }[];
} {
  const usable: RulePack[] = [];
  const refused: { country: string; version: string; reason: string }[] = [];
  for (const pack of packs) {
    if (pack.status !== "REVIEWED" || !pack.review) {
      refused.push({ country: pack.country, version: pack.version, reason: "no expert review on record" });
      continue;
    }
    usable.push(validateRulePack(pack));
  }
  return { usable, refused };
}
