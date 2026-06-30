/** The authorization context returned by the Catalogue's GET /me/authorization. */
export interface ProjectMembership {
  projectId: string;
  orgId: string;
  role: string;
}

export interface AuthorizationContext {
  subject: string;
  platformAdmin: boolean;
  managedOrganisations: string[];
  projectMemberships: ProjectMembership[];
  etag?: string;
  ttlSeconds?: number;
}

export interface ResourceRef {
  projectId?: string;
  orgId?: string;
}

export type Action = string;
