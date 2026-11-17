import { DomainError } from "@erp/kernel";
import { Money } from "@erp/money";
import type { ReceiveInput } from "./inventory";

/**
 * Reads goods received, or opening stock, from a CSV file. The first row names the columns. The required
 * columns are warehouse, item, batch_no, expires_on (may be empty), qty, unit_cost, date and reference.
 * Other columns are ignored. Quoted fields are supported, and a quoted field may contain commas or quotes
 * (doubled). A field may not span lines. Unit costs are in the company currency.
 */
export const RECEIPT_CSV_COLUMNS = ["warehouse", "item", "batch_no", "expires_on", "qty", "unit_cost", "date", "reference"] as const;

export interface CsvReceiptParse {
  /** Rows that read cleanly. They are checked again by the inventory service before anything is written. */
  readonly rows: ReceiveInput[];
  /** Rows that could not be read, with the reason. A file with any of these is not imported. */
  readonly errors: { readonly row: number; readonly message: string }[];
  /** For each row in `rows`, its number in the file (1 is the first row after the header). */
  readonly fileRows: readonly number[];
}

/** Splits CSV text into rows of cells. Empty lines are skipped. A quoted field may contain commas, quotes and line breaks. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let index = 0;
  const endRow = () => {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    row = [];
    field = "";
  };
  while (index < source.length) {
    const char = source[index]!;
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = true;
      index += 1;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      index += 1;
      continue;
    }
    if (char === "\r" || char === "\n") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      endRow();
      index += 1;
      continue;
    }
    field += char;
    index += 1;
  }
  if (quoted) {
    throw new DomainError("VALIDATION", "A quoted field in the file is not closed");
  }
  endRow();
  return rows;
}

export function receiptsFromCsv(text: string, options: { companyId: string; currency: string }): CsvReceiptParse {
  const table = parseCsv(text);
  const header = table[0];
  if (!header) {
    throw new DomainError("VALIDATION", "The file is empty");
  }
  const names = header.map((name) => name.trim().toLowerCase());
  for (const column of RECEIPT_CSV_COLUMNS) {
    if (!names.includes(column)) {
      throw new DomainError("VALIDATION", `The file needs a ${column} column`);
    }
  }
  const at = new Map(names.map((name, position) => [name, position] as const));

  const rows: ReceiveInput[] = [];
  const fileRows: number[] = [];
  const errors: { row: number; message: string }[] = [];
  table.slice(1).forEach((cells, offset) => {
    const row = offset + 1;
    const read = (column: (typeof RECEIPT_CSV_COLUMNS)[number]) => (cells[at.get(column)!] ?? "").trim();
    try {
      const qty = read("qty");
      if (!/^[1-9]\d{0,17}$/.test(qty)) {
        throw new DomainError("VALIDATION", `qty must be a whole number above zero, not "${qty}"`);
      }
      const expires = read("expires_on");
      fileRows.push(row);
      rows.push({
        companyId: options.companyId,
        warehouse: read("warehouse"),
        item: read("item"),
        batchNo: read("batch_no"),
        expiresOn: expires === "" ? null : expires,
        qty: BigInt(qty),
        unitCost: Money.fromDecimal(read("unit_cost"), options.currency),
        date: read("date"),
        reference: read("reference"),
      });
    } catch (error) {
      if (error instanceof DomainError) {
        errors.push({ row, message: error.message });
      } else {
        throw error;
      }
    }
  });
  return { rows, errors, fileRows };
}
