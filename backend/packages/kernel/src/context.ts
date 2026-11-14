/** Who is acting and where. Passed explicitly to every service; never read from globals. */
export interface TenantContext {
  readonly tenantId: string;
  readonly actorId: string | null;
  readonly companyId?: string;
  readonly branchId?: string;
  readonly requestId?: string;
}
