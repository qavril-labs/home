/**
 * Sign-in against the core API (POST /v1/auth/login). The returned session token (`<tenantId>.<random>`)
 * is held in memory only, and it is the token UAAP accepts. Passwords are never stored or logged.
 */
import { getApiBaseUrl, setApiSessionToken } from "./api-client";

export class AuthError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

export async function signInWithPassword(tenantSlug: string, email: string, password: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug, email, password }),
    });
  } catch {
    throw new AuthError("NETWORK", "We could not reach the sign-in service. Check your connection and try again.");
  }
  const body = (await response.json().catch(() => null)) as
    | { token?: string; error?: { code?: string; message?: string } }
    | null;
  if (!response.ok || !body?.token) {
    const code = body?.error?.code ?? "UNAUTHENTICATED";
    throw new AuthError(
      code,
      code === "RATE_LIMITED"
        ? "Too many sign-in attempts. Please wait a few minutes and try again."
        : "Those details did not match. Check the workspace, email and password.",
    );
  }
  setApiSessionToken(body.token);
}
