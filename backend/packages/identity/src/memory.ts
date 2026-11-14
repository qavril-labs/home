import type { IdentityRepository, SessionRecord, UserRecord } from "./service";

/** Repository for unit tests. Production uses the Postgres repository in @erp/db. */
export class InMemoryIdentityRepository implements IdentityRepository {
  private readonly users = new Map<string, UserRecord>();
  private readonly sessions = new Map<string, SessionRecord>();

  async insertUser(user: UserRecord): Promise<void> {
    this.users.set(user.id, user);
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async insertSession(session: SessionRecord): Promise<void> {
    this.sessions.set(session.tokenHash, session);
  }

  async findSession(tokenHash: string): Promise<SessionRecord | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }
}
