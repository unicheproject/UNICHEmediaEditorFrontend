import Keycloak from "keycloak-js";

import { config } from "@/config";

/**
 * Thin wrapper around keycloak-js implementing the platform login posture:
 * Authorization Code + PKCE, tokens held in memory (never web storage), silent refresh.
 * Lifted verbatim from the Portal's reusable platform adapter — every authoring tool
 * reuses this module; only the clientId/URLs differ (supplied via runtime config).
 */
let keycloak: Keycloak | null = null;
let initialised = false;

export interface UserProfile {
  subject: string;
  username?: string;
  email?: string;
  name?: string;
}

export function getKeycloak(): Keycloak {
  if (!keycloak) {
    keycloak = new Keycloak({ url: config.idpUrl, realm: config.realm, clientId: config.clientId });
  }
  return keycloak;
}

/** Attempt a silent SSO check once at startup. Returns whether a session exists. */
export async function initAuth(): Promise<boolean> {
  const kc = getKeycloak();
  if (initialised) {
    return kc.authenticated ?? false;
  }
  initialised = true;
  const authenticated = await kc.init({
    onLoad: "check-sso",
    pkceMethod: "S256",
    silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
    checkLoginIframe: false,
  });
  // The authorization code has already been exchanged for tokens by now, so the OIDC
  // response params left in the URL by the redirect are no longer needed — strip them
  // for a clean address bar (keycloak-js does not always do this reliably).
  cleanOidcParamsFromUrl();
  return authenticated;
}

const OIDC_RESPONSE_KEYS = ["code", "state", "session_state", "iss", "error", "error_description"];

function cleanOidcParamsFromUrl(): void {
  const { pathname, search, hash } = window.location;
  const fragmentHasOidc = /[#&](state|code|session_state|iss|error)=/.test(hash);
  const query = new URLSearchParams(search);
  const queryHasOidc = OIDC_RESPONSE_KEYS.some((k) => query.has(k));
  if (!fragmentHasOidc && !queryHasOidc) {
    return;
  }
  OIDC_RESPONSE_KEYS.forEach((k) => query.delete(k));
  const cleanedSearch = query.toString();
  // Drop the fragment entirely (OIDC uses fragment response mode) and any stray query params.
  const cleanedUrl = pathname + (cleanedSearch ? `?${cleanedSearch}` : "");
  window.history.replaceState(window.history.state, document.title, cleanedUrl);
}

export function login(redirectPath?: string): void {
  getKeycloak().login({ redirectUri: `${window.location.origin}${redirectPath ?? "/"}` });
}

export function logout(): void {
  getKeycloak().logout({ redirectUri: `${window.location.origin}/` });
}

/** A valid access token, refreshing it first if it is about to expire. */
export async function getToken(minValiditySeconds = 30): Promise<string | undefined> {
  const kc = getKeycloak();
  if (!kc.authenticated) {
    return undefined;
  }
  try {
    await kc.updateToken(minValiditySeconds);
  } catch {
    return undefined;
  }
  return kc.token;
}

export function profile(): UserProfile | null {
  const parsed = getKeycloak().tokenParsed as Record<string, unknown> | undefined;
  if (!parsed) {
    return null;
  }
  return {
    subject: String(parsed.sub ?? ""),
    username: parsed.preferred_username as string | undefined,
    email: parsed.email as string | undefined,
    name: parsed.name as string | undefined,
  };
}
