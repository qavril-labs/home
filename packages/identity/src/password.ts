import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { DomainError } from "@erp/kernel";

export const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 256;
const KEY_LENGTH = 32;
const DEFAULT_COST = { N: 32768, r: 8, p: 1 } as const;

interface ScryptCost {
  readonly N: number;
  readonly r: number;
  readonly p: number;
}

function deriveKey(password: string, salt: Buffer, cost: ScryptCost): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { ...cost, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export function assertPasswordPolicy(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new DomainError("VALIDATION", `Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new DomainError("VALIDATION", `Password must be at most ${PASSWORD_MAX_LENGTH} characters`);
  }
}

/** Returns "scrypt$N$r$p$salt$key". The cost parameters are stored so they can be raised later. */
export async function hashPassword(password: string): Promise<string> {
  assertPasswordPolicy(password);
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, DEFAULT_COST);
  return ["scrypt", DEFAULT_COST.N, DEFAULT_COST.r, DEFAULT_COST.p, salt.toString("base64"), key.toString("base64")].join(
    "$",
  );
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !saltB64 || !keyB64) {
    return false;
  }
  try {
    const expected = Buffer.from(keyB64, "base64");
    const actual = await deriveKey(password, Buffer.from(saltB64, "base64"), {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
