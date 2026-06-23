// =============================================================================
// SyncSpeak — Simple TTL In-Memory Cache
// =============================================================================
//
// A zero-dependency key-value cache with per-entry expiry.
// Used to avoid redundant AI calls when the same script is submitted
// multiple times within a short window.
//
// This is server-side only — the cache lives in the Node process memory,
// not in the browser. In serverless environments (e.g. Vercel), each
// cold start gets a fresh cache, which is acceptable: the TTL is short
// and the trade-off is simplicity over distributed consistency.
// =============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix timestamp (ms)
}

const store = new Map<string, CacheEntry<unknown>>();

/** How often (ms) to scan for and delete expired entries. */
const CLEANUP_INTERVAL_MS = 30_000;

// Periodic cleanup to prevent unbounded memory growth
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS).unref();
}

/**
 * Retrieve a cached value if it exists and hasn't expired.
 *
 * @param key    Cache key.
 * @param ttlMs  Maximum age (ms) the entry must be under.
 * @returns      The cached value, or `undefined` if miss / expired.
 */
export function cacheGet<T>(key: string, ttlMs: number): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }

  return entry.value as T;
}

/**
 * Store a value in the cache with a TTL.
 *
 * @param key    Cache key.
 * @param value  Value to cache.
 * @param ttlMs  Time-to-live in milliseconds.
 */
export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Remove a specific key from the cache.
 */
export function cacheInvalidate(key: string): void {
  store.delete(key);
}
