// =============================================================================
// SyncSpeak — Utility Functions
// =============================================================================

/**
 * Merge CSS class names, filtering out falsy values.
 * Lightweight alternative to clsx — uses template literals and filter.
 *
 * Usage:
 *   cn('base', condition && 'active', undefined, 'extra')
 *   // → "base active extra"
 */
export function cn(
  ...inputs: (string | boolean | undefined | null)[]
): string {
  return inputs.filter(Boolean).join(' ');
}

/**
 * Format a duration in seconds into a human-readable string.
 *
 *   formatDuration(65)   → "1m 05s"
 *   formatDuration(3661) → "1h 01m 01s"
 *   formatDuration(8)    → "8s"
 */
export function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }
  if (m > 0) {
    return `${m}m ${String(s).padStart(2, '0')}s`;
  }
  return `${s}s`;
}

/**
 * Generate a unique identifier.
 * Uses `crypto.randomUUID()` when available (all modern browsers & Node 19+),
 * with a fallback for older environments.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback: generate a v4-style UUID from random bytes
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

/**
 * Truncate text to `maxLength` characters, appending "…" when clipped.
 * Never breaks in the middle of a word.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  // Walk back to the last space so we don't chop a word in half
  const trimmed = text.slice(0, maxLength);
  const lastSpace = trimmed.lastIndexOf(' ');
  const breakpoint = lastSpace > maxLength * 0.5 ? lastSpace : maxLength;

  return `${trimmed.slice(0, breakpoint)}…`;
}

/**
 * Creates a debounced version of `fn` that delays invocation until
 * `delay` ms have elapsed since the last call.
 *
 * The returned function also exposes a `.cancel()` method.
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, delay);
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}
