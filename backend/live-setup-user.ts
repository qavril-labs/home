// One-off (local live test only): create the accountant who proposes entries, through the real identity service.
import { createPool, PgIdentityRepository, withTenantTransaction } from "@erp/db";
import { IdentityService } from "@erp/identity";
import { systemClock } from "@erp/kernel";

const tenantId = process.env.LIVE_TENANT_ID ?? "";
const email = process.env.LIVE_ACCOUNTANT_EMAIL ?? "";
const password = process.env.LIVE_ACCOUNTANT_PASSWORD ?? "";
if (!tenantId || !email || !password) throw new Error("set LIVE_TENANT_ID, LIVE_ACCOUNTANT_EMAIL, LIVE_ACCOUNTANT_PASSWORD");

const pool = createPool(process.env.DATABASE_URL ?? "");
try {
  const user = await withTenantTransaction(pool, tenantId, (tx) =>
    new IdentityService(new PgIdentityRepository(tx), tenantId, systemClock).createUser({
      email,
      password,
      roles: ["accountant"],
    }),
  );
  console.log(JSON.stringify({ created: true, userId: user.id }));
} finally {
  await pool.end();
}
