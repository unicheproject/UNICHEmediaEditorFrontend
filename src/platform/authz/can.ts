import type { Action, AuthorizationContext, ResourceRef } from "./types";

/**
 * Evaluate the platform authorization rule against a loaded context. Mirrors the Catalogue's
 * §3.1 rule exactly so tools and the Portal agree without duplicating server logic:
 *
 *   allow if platformAdmin
 *        OR orgId ∈ managedOrganisations
 *        OR projectId ∈ projectMemberships
 *
 * The `action` is accepted for forward-compatibility; the current model is role-uniform.
 */
export function can(
  ctx: AuthorizationContext | null | undefined,
  _action: Action,
  ref: ResourceRef = {},
): boolean {
  if (!ctx) return false;
  if (ctx.platformAdmin) return true;
  if (ref.orgId && ctx.managedOrganisations.includes(ref.orgId)) return true;
  if (ref.projectId && ctx.projectMemberships.some((m) => m.projectId === ref.projectId))
    return true;
  return false;
}
