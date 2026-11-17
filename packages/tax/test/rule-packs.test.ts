import { describe, expect, it } from "vitest";
import { DomainError } from "@erp/kernel";
import { usableRulePacks, validateRulePack, type RulePack } from "../src/rule-packs";

const review = { reviewer: "A. Reviewer", qualification: "Chartered accountant", reviewedOn: "2026-11-10" };
const codes = [{ code: "STD", name: "Standard", rates: [] }] as unknown as RulePack["taxCodes"];

describe("country rule packs", () => {
  it("refuses a draft pack, with the reason recorded", () => {
    const result = usableRulePacks([{ country: "XX", version: "0.1.0", status: "DRAFT", taxCodes: codes }]);
    expect(result.usable).toHaveLength(0);
    expect(result.refused).toEqual([{ country: "XX", version: "0.1.0", reason: "no expert review on record" }]);
  });

  it("uses a reviewed pack with a complete review record", () => {
    const pack: RulePack = { country: "XX", version: "1.0.0", status: "REVIEWED", review, taxCodes: codes };
    expect(usableRulePacks([pack]).usable).toEqual([pack]);
  });

  it("refuses a reviewed pack whose review record is incomplete", () => {
    const incomplete: RulePack = { country: "XX", version: "1.0.0", status: "REVIEWED", review: { ...review, reviewer: "  " }, taxCodes: codes };
    expect(() => validateRulePack(incomplete)).toThrow(DomainError);
    const noReview: RulePack = { country: "XX", version: "1.0.0", status: "REVIEWED", taxCodes: codes };
    expect(usableRulePacks([noReview]).refused).toHaveLength(1);
  });

  it("refuses a bad review date", () => {
    const badDate: RulePack = { country: "XX", version: "1.0.0", status: "REVIEWED", review: { ...review, reviewedOn: "10/11/2026" }, taxCodes: codes };
    expect(() => validateRulePack(badDate)).toThrow(DomainError);
  });

  it("requires a two-letter country code and a three-part version", () => {
    expect(() => validateRulePack({ country: "Kenya", version: "1.0.0", status: "DRAFT", taxCodes: codes })).toThrow(DomainError);
    expect(() => validateRulePack({ country: "KE", version: "1", status: "DRAFT", taxCodes: codes })).toThrow(DomainError);
  });
});
