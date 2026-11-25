import { DomainError, newId, systemClock, type Clock } from "@erp/kernel";
import { BUILT_IN_ROLES, expandRoles } from "./permissions";
import { hashPassword, verifyPassword } from "./password";
import { createSessionToken, hashSessionToken } from "./tokens";

export type UserStatus = "ACTIVE" | "DISABLED";

export interface UserRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly roles: readonly string[];
  readonly status: UserStatus;
  readonly createdAt: string;
}

export interface SessionRecord {
  readonly tokenHash: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly expiresAt: string;
}

/** Tenant-bound: implementations must only see rows for the tenant in context. */
export interface IdentityRepository {
  insertUser(user: UserRecord): Promise<void>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  insertSession(session: SessionRecord): Promise<void>;
  findSession(tokenHash: string): Promise<SessionRecord | null>;
  deleteSession(tokenHash: string): Promise<void>;
}

export interface Principal {
  readonly userId: string;
  readonly tenantId: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

export interface CreateUserInput {
  readonly email: string;
  readonly password: string;
  readonly roles: readonly string[];
}

export type PublicUser = Omit<UserRecord, "passwordHash">;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const INVALID_CREDENTIALS = "Invalid credentials";

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

function toPrincipal(user: UserRecord): Principal {
  return {
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    roles: user.roles,
    permissions: expandRoles(user.roles),
  };
}

export class IdentityService {
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly repo: IdentityRepository,
    private readonly tenantId: string,
    private readonly clock: Clock = systemClock,
    private readonly sessionTtlMs = SESSION_TTL_MS,
  ) {}

  async createUser(input: CreateUserInput): Promise<PublicUser> {
    const email = normalizeEmail(input.email);
    if (!EMAIL_PATTERN.test(email)) {
      throw new DomainError("VALIDATION", "Email address is not valid");
    }
    const unknownRoles = input.roles.filter((role) => !Object.hasOwn(BUILT_IN_ROLES, role));
    if (unknownRoles.length > 0) {
      throw new DomainError("VALIDATION", `Unknown roles: ${unknownRoles.join(", ")}`);
    }
    if (await this.repo.findUserByEmail(email)) {
      throw new DomainError("CONFLICT", "Email is already registered");
    }
    const user: UserRecord = {
      id: newId(this.clock.now().getTime()),
      tenantId: this.tenantId,
      email,
      passwordHash: await hashPassword(input.password),
      roles: [...new Set(input.roles)].sort(),
      status: "ACTIVE",
      createdAt: this.clock.now().toISOString(),
    };
    await this.repo.insertUser(user);
    const { passwordHash: _hidden, ...publicUser } = user;
    return publicUser;
  }

  async login(email: string, password: string): Promise<{ token: string; expiresAt: string; principal: Principal }> {
    const user = await this.repo.findUserByEmail(normalizeEmail(email));
    if (!user || user.status !== "ACTIVE") {
      // Spend the same time as a real check, so response timing does not reveal which emails exist.
      await verifyPassword(password, await this.dummy());
      throw new DomainError("UNAUTHENTICATED", INVALID_CREDENTIALS);
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new DomainError("UNAUTHENTICATED", INVALID_CREDENTIALS);
    }
    const token = createSessionToken(this.tenantId);
    const expiresAt = new Date(this.clock.now().getTime() + this.sessionTtlMs).toISOString();
    await this.repo.insertSession({
      tokenHash: hashSessionToken(token),
      tenantId: this.tenantId,
      userId: user.id,
      expiresAt,
    });
    return { token, expiresAt, principal: toPrincipal(user) };
  }

  async authenticate(token: string): Promise<Principal> {
    const session = await this.repo.findSession(hashSessionToken(token));
    if (!session || session.tenantId !== this.tenantId || Date.parse(session.expiresAt) <= this.clock.now().getTime()) {
      throw new DomainError("UNAUTHENTICATED", "Session is invalid or expired");
    }
    const user = await this.repo.findUserById(session.userId);
    if (!user || user.status !== "ACTIVE") {
      throw new DomainError("UNAUTHENTICATED", "Session is invalid or expired");
    }
    return toPrincipal(user);
  }

  async logout(token: string): Promise<void> {
    await this.repo.deleteSession(hashSessionToken(token));
  }

  private dummy(): Promise<string> {
    this.dummyHash ??= hashPassword("timing-equalizer-password");
    return this.dummyHash;
  }
}
