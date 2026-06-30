import { fetchAuthorization } from "@/lib/catalogue";

import { AuthorizationCache } from "./cache";

export * from "./types";
export { can } from "./can";
export { AuthorizationCache } from "./cache";
export type { AuthorizationFetcher, AuthorizationFetchResult } from "./cache";

/** Shared, app-wide authorization cache wired to the Catalogue. */
export const authorizationCache = new AuthorizationCache(fetchAuthorization);
