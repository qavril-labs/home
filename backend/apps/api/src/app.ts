import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import { hashPassword, IdentityService, tenantFromToken } from "@erp/identity";
import { missingDependencies } from "@erp/tenancy";
import { buildRegistry, isFoundation } from "@erp/catalog";
import {
  PgIdentityRepository,
  PgTenantRepository,
  listEntitlements,
  withTenantTransaction,
  type Pool,
} from "@erp/db";
import { DomainError, newId, systemClock, type Clock } from "@erp/kernel";
import { RateLimiter, type RateLimitOptions } from "./rate-limit";
import { bearerToken, createAuthenticator } from "./auth";
import { registerLedgerRoutes } from "./ledger-routes";
import { registerMasterDataRoutes } from "./master-data-routes";
import { registerInvoicingRoutes } from "./invoicing-routes";
import { registerApprovalsRoutes } from "./approvals-routes";
import { MemoryTicketStore, type TicketStore } from "./stream-tickets";
import { registerCmsRoutes } from "./cms-routes";
import type { EmailJobQueue } from "@erp/notifications";
import { registerBankingRoutes } from "./banking-routes";
import { registerPurchasingRoutes } from "./purchasing-routes";
import { registerNotificationRoutes } from "./notifications-routes";
import { SignupBody, provisionTenant, signUp } from "./signup";
import { registerWorkspaceRoutes } from "./workspace";

const ProductsBody = z.object({
  products: z.array(z.string().min(1)).min(1).max(50),
});

const TenantParams = z.object({ tenantId: z.uuid() });

/** The demo slots offered on the booking form. Keep in step with SLOTS in scripts/build-site-pages.mjs. */
export const DEMO_SLOTS = [
  "Monday morning", "Monday afternoon", "Tuesday morning", "Tuesday afternoon", "Wednesday morning",
  "Wednesday afternoon", "Thursday morning", "Thursday afternoon", "Friday morning", "Friday afternoon",
] as const;

const LeadBody = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  company: z.string().trim().max(160).optional(),
  country: z.string().trim().max(80).optional(),
  interest: z.enum(["early_access", "demo", "partner", "trial"]),
  industry: z.string().trim().max(80).optional(),
  message: z.string().trim().max(1000).optional(),
  source: z.string().trim().max(100).optional(),
  slot: z.enum(DEMO_SLOTS).or(z.literal("")).optional(),
  timezone: z.string().trim().max(64).optional(),
  consent: z.literal(true),
  /** Honeypot. Real visitors never fill this in. */
  website: z.string().max(200).optional(),
});

const BootstrapBody = z.object({
  tenant: z.object({ slug: z.string(), name: z.string(), region: z.string() }),
  company: z.object({
    legalName: z.string(),
    countryCode: z.string(),
    baseCurrency: z.string(),
    fiscalYearStartMonth: z.number().int(),
  }),
  admin: z.object({ email: z.string(), password: z.string() }),
});

const LoginBody = z.object({
  tenantSlug: z.string().min(1),
  email: z.string().min(1),
  password: z.string().min(1),
});

const ForgotPasswordBody = z.object({
  tenantSlug: z.string().min(1),
  email: z.string().email(),
});

const ResetPasswordBody = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export interface AppOptions {
  readonly pool: Pool;
  readonly platformKey: string;
  readonly clock?: Clock;
  readonly logger?: boolean;
  /** Origins allowed to call the public lead endpoint from a browser, for example the marketing site. */
  readonly corsOrigins?: readonly string[];
  /** Set when the API runs behind a proxy, so request.ip is the visitor's address. */
  readonly trustProxy?: boolean;
  /** Queue for outgoing email (PLT-10). Without it, email reminders are recorded but not sent. */
  readonly emailQueue?: EmailJobQueue;
  readonly leadRateLimit?: RateLimitOptions;
  /** Limits self-service sign-ups and sign-ins per IP. */
  readonly signupRateLimit?: RateLimitOptions;
  /** Optional URL that receives a JSON copy of each new lead, for example a chat or form tool. */
  readonly leadWebhookUrl?: string;
  /** Where stream tickets are kept. Pass a Redis store when more than one API instance runs. */
  readonly ticketStore?: TicketStore;
}

/** Sends a copy of a new lead to the operator's webhook. A failed send is logged and the lead is kept. */
function notifyOperator(
  id: string,
  lead: z.infer<typeof LeadBody>,
  createdAt: string,
  url: string,
  log: { warn: (message: string) => void },
): void {
  const payload = {
    id,
    createdAt,
    name: lead.name,
    email: lead.email,
    company: lead.company ?? null,
    country: lead.country ?? null,
    interest: lead.interest,
    industry: lead.industry ?? null,
    slot: lead.slot || null,
    timezone: lead.timezone ?? null,
    message: lead.message ?? null,
    source: lead.source ?? "direct",
  };
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  })
    .then((response) => {
      if (!response.ok) log.warn(`lead webhook answered ${response.status}`);
    })
    .catch(() => log.warn("lead webhook could not be reached"));
}

function assertPlatformKey(provided: string | string[] | undefined, expected: string): void {
  const value = Array.isArray(provided) ? provided[0] : provided;
  const actual = Buffer.from(value ?? "");
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) {
    throw new DomainError("FORBIDDEN", "A valid platform key is required");
  }
}

export function buildApp(options: AppOptions): FastifyInstance {
  const { pool, platformKey, clock = systemClock } = options;
  const app = Fastify({
    // Request logs keep the path but never the query string, so tokens passed in a URL are not written to logs.
    logger: options.logger
      ? {
          serializers: {
            req: (req: { method: string; url: string; id: unknown; ip?: string }) => ({
              method: req.method,
              url: req.url.split("?")[0],
              reqId: req.id,
              remoteAddress: req.ip,
            }),
          },
        }
      : false,
    trustProxy: options.trustProxy ?? false,
    // Every request gets an id: it is logged and echoed back, so a support ticket can be traced.
    genReqId: (request) => {
      const incoming = request.headers["x-request-id"];
      return typeof incoming === "string" && /^[A-Za-z0-9._-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    },
    // Larger bodies are refused before parsing. The biggest legitimate request is a CMS article.
    bodyLimit: 256 * 1024,
  });

  // Security headers on every response. The API serves JSON only, so nothing here may be rendered.
  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("x-request-id", request.id);
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "no-referrer");
    reply.header("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
    reply.header("strict-transport-security", "max-age=31536000");
    // Signed-in data must not be stored by browsers or shared caches. Public CMS content may be cached.
    if (request.url.startsWith("/v1/") && !request.url.startsWith("/v1/public/cms/")) {
      reply.header("cache-control", "no-store");
    }
    return payload;
  });
  const corsOrigins = new Set(options.corsOrigins ?? []);
  const leadLimiter = new RateLimiter(options.leadRateLimit ?? { max: 5, windowMs: 10 * 60 * 1000 });
  const signupLimiter = new RateLimiter(options.signupRateLimit ?? { max: 5, windowMs: 60 * 60 * 1000 });
  const loginLimiter = new RateLimiter({ max: 20, windowMs: 10 * 60 * 1000 });
  const apiLimiter = new RateLimiter({ max: 300, windowMs: 60 * 1000 });

  // Global rate limiter for authenticated /v1/ API routes (PLT-21)
  app.addHook("preHandler", async (request, reply) => {
    if (request.url.startsWith("/v1/") && !request.url.startsWith("/v1/public/") && request.method !== "OPTIONS") {
      const authHeader = request.headers.authorization;
      const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      const tenantId = token ? tenantFromToken(token) : null;
      // Keyed by tenant and address together, so a forged token for another tenant only uses up the sender's own allowance.
      const key = `${tenantId ?? "-"}:${request.ip}`;
      const now = clock.now().getTime();
      if (apiLimiter.blocked(key, now)) {
        reply.header("retry-after", "60");
        throw new DomainError("RATE_LIMITED", "API rate limit exceeded. Please wait a moment before sending more requests.");
      }
      apiLimiter.hit(key, now);
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) {
      return reply.status(error.httpStatus).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        error: { code: "VALIDATION", message: "Invalid request", details: error.issues },
      });
    }
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({ error: { code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Bad request" } });
    }
    request.log.error(error);
    return reply.status(500).send({ error: { code: "INTERNAL", message: "Unexpected error" } });
  });

  const authenticate = createAuthenticator(pool, clock);

  // Liveness: the process is up. Readiness: the process can reach its database, so a load balancer
  // should route traffic to it. Keep the readiness check cheap; it runs on every probe.
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ready" };
    } catch {
      return reply.status(503).send({ status: "unavailable" });
    }
  });

  /** Creates a tenant, its first company, and its administrator in one transaction. */
  app.post("/v1/platform/tenants", async (request, reply) => {
    assertPlatformKey(request.headers["x-platform-key"], platformKey);
    const body = BootstrapBody.parse(request.body);
    const result = await provisionTenant(pool, clock, body, "platform");
    return reply.status(201).send(result);
  });

  app.post("/v1/auth/login", async (request, reply) => {
    allowBrowserOrigin(request, reply);
    const now = clock.now().getTime();
    if (loginLimiter.blocked(request.ip, now)) {
      throw new DomainError("RATE_LIMITED", "Too many sign-in attempts. Please try again later.");
    }
    loginLimiter.hit(request.ip, now);
    const body = LoginBody.parse(request.body);
    const tenant = await new PgTenantRepository(pool).findTenantBySlug(body.tenantSlug.toLowerCase());
    if (!tenant || tenant.status !== "ACTIVE") {
      throw new DomainError("UNAUTHENTICATED", "Invalid credentials");
    }
    return withTenantTransaction(pool, tenant.id, (tx) =>
      new IdentityService(new PgIdentityRepository(tx), tenant.id, clock).login(body.email, body.password),
    );
  });

  app.get("/v1/me", async (request) => ({ principal: await authenticate(request) }));

  app.post("/v1/auth/logout", async (request, reply) => {
    allowBrowserOrigin(request, reply);
    const token = bearerToken(request);
    const tenantId = tenantFromToken(token);
    if (!tenantId) {
      throw new DomainError("UNAUTHENTICATED", "Session is invalid or expired");
    }
    await withTenantTransaction(pool, tenantId, (tx) =>
      new IdentityService(new PgIdentityRepository(tx), tenantId, clock).logout(token),
    );
    return reply.status(204).send();
  });

  app.post("/v1/auth/forgot-password", async (request, reply) => {
    allowBrowserOrigin(request, reply);
    const body = ForgotPasswordBody.parse(request.body);
    const tenant = await new PgTenantRepository(pool).findTenantBySlug(body.tenantSlug.toLowerCase());
    if (tenant && tenant.status === "ACTIVE") {
      await withTenantTransaction(pool, tenant.id, async (tx) => {
        const user = await tx.query("SELECT id FROM users WHERE email = $1", [body.email.trim().toLowerCase()]);
        if (user.rows.length > 0) {
          const rawToken = randomUUID() + "-" + randomUUID();
          const tokenHash = createHash("sha256").update(rawToken).digest("hex");
          const expiresAt = new Date(clock.now().getTime() + 3600 * 1000).toISOString();
          await tx.query(
            "INSERT INTO password_reset_tokens (token_hash, tenant_id, user_id, expires_at) VALUES ($1, $2, $3, $4)",
            [tokenHash, tenant.id, user.rows[0].id, expiresAt]
          );
        }
      });
    }
    return { ok: true, message: "If an account exists with this email, password reset instructions have been generated." };
  });

  app.post("/v1/auth/reset-password", async (request, reply) => {
    allowBrowserOrigin(request, reply);
    const body = ResetPasswordBody.parse(request.body);
    const tokenHash = createHash("sha256").update(body.token).digest("hex");
    const now = clock.now().toISOString();

    const record = await pool.query(
      "SELECT * FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > $2",
      [tokenHash, now]
    );

    if (record.rows.length === 0) {
      throw new DomainError("UNAUTHENTICATED", "Password reset token is invalid or expired");
    }

    const { tenant_id: tenantId, user_id: userId } = record.rows[0];
    const newHash = await hashPassword(body.newPassword);

    await withTenantTransaction(pool, tenantId, async (tx) => {
      await tx.query("UPDATE users SET password_hash = $1 WHERE id = $2 AND tenant_id = $3", [newHash, userId, tenantId]);
      await tx.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [userId]);
      await tx.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    });

    return { ok: true, message: "Password has been successfully updated. Please sign in with your new password." };
  });

  function allowBrowserOrigin(request: FastifyRequest, reply: FastifyReply): void {
    const origin = request.headers.origin;
    reply.header("vary", "Origin");
    if (typeof origin === "string" && corsOrigins.has(origin)) {
      reply.header("access-control-allow-origin", origin);
      reply.header("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      reply.header("access-control-allow-headers", "content-type, authorization, x-platform-key, x-request-id");
      reply.header("access-control-max-age", "600");
    }
  }

  // Handle all CORS preflight OPTIONS requests across all API routes
  app.options("/*", async (request, reply) => {
    allowBrowserOrigin(request, reply);
    return reply.status(204).send();
  });

  // The signed-in app calls these from the site's origin too.
  app.addHook("onRequest", async (request, reply) => {
    if (
      request.url.startsWith("/v1/workspace/") ||
      request.url.startsWith("/v1/master-data/") ||
      request.url.startsWith("/v1/invoicing/") ||
      request.url.startsWith("/v1/events/") ||
      request.url.startsWith("/v1/approvals") ||
      request.url.startsWith("/v1/approval-requests") ||
      request.url.startsWith("/v1/procurement/") ||
      request.url.startsWith("/v1/banking/") ||
      request.url.startsWith("/v1/notifications") ||
      request.url === "/v1/me"
    ) {
      allowBrowserOrigin(request, reply);
    }
  });

  for (const url of ["/v1/public/leads", "/v1/public/signup", "/v1/auth/login", "/v1/auth/logout", "/v1/me", "/v1/workspace/overview", "/v1/workspace/starter-books", "/v1/workspace/quick-entries"]) {
    app.route({
      method: "OPTIONS",
      url,
      handler: async (request, reply) => {
        allowBrowserOrigin(request, reply);
        return reply.status(204).send();
      },
    });
  }

  /**
   * Self-service sign-up from the marketing site: creates the workspace, its company and its
   * owner, then signs the owner in. Rate-limited per IP; honeypot submissions are dropped.
   */
  app.post("/v1/public/signup", async (request, reply) => {
    allowBrowserOrigin(request, reply);
    const now = clock.now().getTime();
    if (signupLimiter.blocked(request.ip, now)) {
      throw new DomainError("RATE_LIMITED", "Too many sign-ups from this address. Please try again later.");
    }
    const body = SignupBody.parse(request.body);
    if (body.website) {
      throw new DomainError("VALIDATION", "Sign-up could not be completed");
    }
    signupLimiter.hit(request.ip, now);
    const result = await signUp(pool, clock, body);
    return reply.status(201).send({
      workspace: result.tenant.slug,
      tenantId: result.tenant.id,
      company: { id: result.company.id, name: result.company.legalName },
      session: result.session,
    });
  });

  /**
   * Public intake from the marketing site. Leads are not tenant data, so this writes through
   * the pool rather than a tenant transaction. Rate-limited per IP. Honeypot submissions get
   * the same 201 response and are not stored.
   */
  app.post("/v1/public/leads", async (request, reply) => {
    allowBrowserOrigin(request, reply);
    // Only accepted requests use up the allowance. A mistyped form or a honeypot hit does not.
    const now = clock.now().getTime();
    if (leadLimiter.blocked(request.ip, now)) {
      throw new DomainError("RATE_LIMITED", "Too many requests. Please try again later.");
    }
    const body = LeadBody.parse(request.body);
    if (body.website) {
      return reply.status(201).send({ status: "received" });
    }
    leadLimiter.hit(request.ip, now);
    const id = newId(clock.now().getTime());
    const createdAt = clock.now().toISOString();
    // A repeat of the same request within a day (for example a retry after a timeout) is not stored twice.
    const inserted = await pool.query(
      `INSERT INTO leads (id, name, email, company, country, interest, industry, message, source, created_at,
                          consent_given, consent_at, slot, timezone)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $10, $11, $12
        WHERE NOT EXISTS (
          SELECT 1 FROM leads
           WHERE lower(email) = lower($3) AND interest = $6 AND created_at > $10::timestamptz - interval '1 day'
        )`,
      [
        id,
        body.name,
        body.email,
        body.company || null,
        body.country || null,
        body.interest,
        body.industry || null,
        body.message || null,
        body.source || "direct",
        createdAt,
        body.slot || null,
        body.timezone || null,
      ],
    );
    if (inserted.rowCount === 1 && options.leadWebhookUrl) {
      notifyOperator(id, body, createdAt, options.leadWebhookUrl, request.log);
    }
    return reply.status(201).send({ status: "received" });
  });

  /**
   * Turns products on for a tenant. Each product must have its required products enabled too.
   * Foundation products (phase P0) are always on, so they are not required explicitly.
   */
  app.post("/v1/platform/tenants/:tenantId/products", async (request, reply) => {
    assertPlatformKey(request.headers["x-platform-key"], platformKey);
    const { tenantId } = TenantParams.parse(request.params);
    const body = ProductsBody.parse(request.body);
    const tenant = await new PgTenantRepository(pool).findTenantById(tenantId);
    if (!tenant) {
      throw new DomainError("NOT_FOUND", "Tenant not found");
    }
    const registry = buildRegistry();
    const enabled = await withTenantTransaction(pool, tenantId, async (tx) => {
      const current = await listEntitlements(tx);
      const selection = [...new Set([...current, ...body.products])];
      const missing = missingDependencies(selection, registry).filter((id) => {
        const product = registry.get(id);
        return product !== undefined && !isFoundation(product);
      });
      if (missing.length > 0) {
        throw new DomainError("UNPROCESSABLE", `These products need ${missing.join(", ")} enabled first`, { missing });
      }
      for (const productId of body.products) {
        await tx.query("INSERT INTO tenant_products (tenant_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
          tenantId,
          productId,
        ]);
      }
      return [...selection].sort();
    });
    return reply.status(200).send({ tenantId, products: enabled });
  });

  registerLedgerRoutes(app, { pool, clock, authenticate });
  registerWorkspaceRoutes(app, { pool, clock, authenticate });
  registerMasterDataRoutes(app, { pool, clock, authenticate });
  registerInvoicingRoutes(app, { pool, clock, authenticate, tickets: options.ticketStore ?? new MemoryTicketStore(), emailQueue: options.emailQueue });
  registerApprovalsRoutes(app, { pool, clock, authenticateRequest: authenticate });
  registerBankingRoutes(app, { pool, clock, authenticate });
  registerPurchasingRoutes(app, { pool, clock, authenticate });
  registerNotificationRoutes(app, { pool, authenticate });
  registerCmsRoutes(app, pool, platformKey);

  return app;
}
