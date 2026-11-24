/**
 * Permission strings look like "fin.journal.post". A grant can be:
 *   "*"          every permission
 *   "fin.*"      every permission under "fin."
 *   "fin.journal.post"   exactly that permission
 *
 * Built-in roles are placeholders for Phase 0. Tenant-defined roles arrive with PLT-01 in Phase 2.
 */
export const BUILT_IN_ROLES: Readonly<Record<string, readonly string[]>> = {
  tenant_admin: ["*"],
  accountant: ["fin.*", "mdm.*", "prc.*", "sal.*"],
  user: [],
  // Project management bots (PSA-01 bots). Spec: docs/pm-bots-mvp-spec.md.
  project_manager: ["pm.bots.configure", "pm.bots.override", "pm.bots.view_logs"],
  project_lead: ["pm.bots.override"],
};

export function expandRoles(roles: readonly string[]): string[] {
  const granted = new Set<string>();
  for (const role of roles) {
    for (const permission of BUILT_IN_ROLES[role] ?? []) {
      granted.add(permission);
    }
  }
  return [...granted].sort();
}

export function hasPermission(granted: readonly string[], required: string): boolean {
  return granted.some(
    (grant) => grant === "*" || grant === required || (grant.endsWith(".*") && required.startsWith(grant.slice(0, -1))),
  );
}
