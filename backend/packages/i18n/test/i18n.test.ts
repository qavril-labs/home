import { describe, expect, it } from "vitest";
import { DomainError } from "@erp/kernel";
import { Money } from "@erp/money";
import { Translator, fallbackChain, formatDate, formatMoney, textDirection } from "../src";

describe("Translator", () => {
  it("falls back from region to language to default locale", () => {
    const translator = new Translator("en");
    translator.register("en", { "invoice.title": "Invoice" });
    translator.register("ar", { "invoice.title": "فاتورة" });
    translator.register("ar-SA", { "invoice.greeting": "مرحبا" });

    expect(translator.t("invoice.title", {}, "ar-SA")).toBe("فاتورة");
    expect(translator.t("invoice.greeting", {}, "ar-SA")).toBe("مرحبا");
    expect(translator.t("invoice.title", {}, "fr-FR")).toBe("Invoice");
  });

  it("interpolates named placeholders and leaves unknown ones visible", () => {
    const translator = new Translator("en");
    translator.register("en", { "due": "Due {date} for {customer}" });
    expect(translator.t("due", { date: "2026-11-30" })).toBe("Due 2026-11-30 for {customer}");
  });

  it("returns the key when no translation exists", () => {
    expect(new Translator("en").t("missing.key")).toBe("missing.key");
  });

  it("ignores inherited object properties as keys", () => {
    expect(new Translator("en").t("constructor")).toBe("constructor");
  });

  it("builds fallback chains", () => {
    expect(fallbackChain("pt_BR", "en")).toEqual(["pt-br", "pt", "en"]);
    expect(fallbackChain("en", "en")).toEqual(["en"]);
  });
});

describe("locale helpers", () => {
  it("detects right-to-left languages", () => {
    expect(textDirection("ar-SA")).toBe("rtl");
    expect(textDirection("ur")).toBe("rtl");
    expect(textDirection("en-KE")).toBe("ltr");
  });

  it("formats money with the currency's own decimals", () => {
    expect(formatMoney(Money.fromDecimal("1234.5", "USD"), "en-US")).toContain("1,234.50");
    expect(formatMoney(Money.fromDecimal("1234", "JPY"), "en-US")).toContain("1,234");
    expect(formatMoney(Money.fromDecimal("1.5", "KWD"), "en-US")).toContain("1.500");
  });

  it("formats business dates in UTC so they do not shift", () => {
    expect(formatDate("2026-11-30", "en-US")).toContain("Nov");
    expect(formatDate("2026-11-30", "en-US")).toContain("30");
    expect(() => formatDate("30/11/2026", "en-US")).toThrow(DomainError);
  });
});
