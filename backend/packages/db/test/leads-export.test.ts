import { describe, expect, it } from "vitest";
import { LEAD_CSV_HEADER, leadsToCsv, type LeadRow } from "../src/leads";

const base: LeadRow = {
  id: "0190a000-0000-7000-8000-000000000001",
  name: "Ada Lovelace",
  email: "ada@example.com",
  company: "Analytical Ltd",
  country: "Kenya",
  interest: "early_access",
  industry: "Retail or pharmacy",
  message: "We run three shops.",
  source: "direct",
  createdAt: "2026-11-01T10:00:00.000Z",
};

describe("leadsToCsv", () => {
  it("writes a header and one line per lead", () => {
    const csv = leadsToCsv([base]);
    const [header, line] = csv.trimEnd().split("\r\n");
    expect(header).toBe(LEAD_CSV_HEADER.join(","));
    expect(line).toBe(
      "2026-11-01T10:00:00.000Z,Ada Lovelace,ada@example.com,Analytical Ltd,Kenya,early_access,Retail or pharmacy,We run three shops.,direct,0190a000-0000-7000-8000-000000000001,,,new,",
    );
  });

  it("quotes commas, quotes, and line breaks", () => {
    const csv = leadsToCsv([{ ...base, message: 'Shops, "two" and\nthree' }]);
    expect(csv).toContain('"Shops, ""two"" and\nthree"');
  });

  it("neutralizes spreadsheet formulas", () => {
    const csv = leadsToCsv([
      { ...base, name: "=HYPERLINK(\"https://evil.example\")", company: "+1 555", message: "-cmd", industry: "@sum" },
    ]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+1 555");
    expect(csv).toContain("'-cmd");
    expect(csv).toContain("'@sum");
  });

  it("leaves empty optional fields blank", () => {
    const csv = leadsToCsv([{ ...base, company: null, country: null, industry: null, message: null }]);
    const line = csv.trimEnd().split("\r\n")[1]!;
    expect(line).toBe(
      "2026-11-01T10:00:00.000Z,Ada Lovelace,ada@example.com,,,early_access,,,direct,0190a000-0000-7000-8000-000000000001,,,new,",
    );
    expect(line.split(",")).toHaveLength(LEAD_CSV_HEADER.length);
  });

  it("returns only the header when there are no leads", () => {
    expect(leadsToCsv([])).toBe(`${LEAD_CSV_HEADER.join(",")}\r\n`);
  });
});
