// =============================================================================
// SyncSpeak — In-Memory Rate Limiter
// =============================================================================
//
// Lightweight, zero-dependency rate limiter for serverless API routes.
// Uses a Map<string, { count, resetAt }> with automatic expiry of stale
// entries so it never leaks memory.
//
// This enforces the backend principle that the server controls access —
// clients cannot be trusted to self-throttle.
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number; // Unix timestamp (ms) when the window resets
}

const store = new Map<string, RateLimitEntry>();

/** How often (ms) to scan for and delete expired entries. */
const CLEANUP_INTERVAL_MS = 60_000;

// Periodic cleanup to prevent memory leaks in long-running processes
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS).unref(); // .unref() so the timer doesn't keep the process alive
}

export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** How many requests remain in the current window. */
  remaining: number;
  /** Milliseconds until the window resets (0 if allowed). */
  retryAfterMs: number;
}

/**
 * Check (and increment) the rate limit for a given key (typically an IP).
 *
 * @param key        Identifier for the rate-limit bucket (e.g. IP address).
 * @param maxRequests Maximum requests allowed in the window.
 * @param windowMs   Length of the rate-limit window in milliseconds.
 * @returns          Whether the request is allowed, with remaining count and retry-after.
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();

  let entry = store.get(key);

  // If no entry or the window has expired, start a fresh window
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count += 1;

  const remaining = Math.max(0, maxRequests - entry.count);

  if (entry.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.resetAt - now,
    };
  }

  return {
    allowed: true,
    remaining,
    retryAfterMs: 0,
  };
}
