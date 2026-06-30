import { config } from "@/config";
import { getToken, login } from "@/platform/auth";
import type { AuthorizationContext } from "@/platform/authz/types";
import type { AuthorizationFetchResult } from "@/platform/authz/cache";

/**
 * Minimal Catalogue client (native fetch + bearer). The Media Editor talks to its own
 * backend for project data; it calls the Catalogue directly only for the authorization
 * context and organisation names (used by the create-project org picker).
 */
const BASE = `${config.catalogueUrl}/api/v1`;

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchAuthorization(etag?: string): Promise<AuthorizationFetchResult> {
  const headers = await authHeaders();
  if (etag) {
    headers["If-None-Match"] = etag;
  }
  const res = await fetch(`${BASE}/me/authorization`, { headers });
  if (res.status === 401) {
    login(window.location.pathname + window.location.search);
    throw new Error("Not authenticated");
  }
  if (res.status === 304) {
    return { status: 304 };
  }
  if (!res.ok) {
    throw new Error(`Authorization fetch failed (${res.status})`);
  }
  const data = (await res.json()) as AuthorizationContext;
  return { status: 200, data, etag: res.headers.get("etag") ?? undefined };
}

export interface OrganisationDto {
  id: string;
  name: string;
  slug: string;
  status: string;
}

/** Organisations visible to the caller — used to resolve org names in the picker. */
export async function listOrganisations(): Promise<OrganisationDto[]> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}/organisations`, { headers });
  if (res.status === 401) {
    login(window.location.pathname + window.location.search);
    throw new Error("Not authenticated");
  }
  if (!res.ok) {
    throw new Error(`Failed to load organisations (${res.status})`);
  }
  return (await res.json()) as OrganisationDto[];
}
