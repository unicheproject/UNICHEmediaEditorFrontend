import type { AuthorizationContext } from "./types";

export interface AuthorizationFetchResult {
  /** HTTP status; 304 means "not modified, keep the cached copy". */
  status: number;
  data?: AuthorizationContext;
  etag?: string;
}

export type AuthorizationFetcher = (etag?: string) => Promise<AuthorizationFetchResult>;

const DEFAULT_TTL_SECONDS = 45;

/**
 * Short-TTL cache over GET /me/authorization honouring ETag. Framework-free and clock-injectable
 * so it is trivially unit-testable and reusable by every authoring tool.
 */
export class AuthorizationCache {
  private cached: AuthorizationContext | null = null;
  private etag: string | undefined;
  private expiresAt = 0;

  constructor(
    private readonly fetcher: AuthorizationFetcher,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Return the context, fetching/revalidating only when the TTL has expired (or force=true). */
  async get(force = false): Promise<AuthorizationContext> {
    if (!force && this.cached && this.now() < this.expiresAt) {
      return this.cached;
    }
    const result = await this.fetcher(this.etag);
    if (result.status === 304 && this.cached) {
      this.bumpTtl(this.cached.ttlSeconds);
      return this.cached;
    }
    if (!result.data) {
      throw new Error("Authorization fetch returned no data");
    }
    this.cached = result.data;
    this.etag = result.etag ?? result.data.etag;
    this.bumpTtl(result.data.ttlSeconds);
    return this.cached;
  }

  /** Drop the cache so the next get() re-fetches. */
  invalidate(): void {
    this.cached = null;
    this.etag = undefined;
    this.expiresAt = 0;
  }

  current(): AuthorizationContext | null {
    return this.cached;
  }

  private bumpTtl(ttlSeconds?: number): void {
    const ttl = ttlSeconds && ttlSeconds > 0 ? ttlSeconds : DEFAULT_TTL_SECONDS;
    this.expiresAt = this.now() + ttl * 1000;
  }
}
