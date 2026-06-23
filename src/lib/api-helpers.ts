// =============================================================================
// SyncSpeak — API Route Helpers
// =============================================================================
//
// Shared utilities for all API route handlers:
//   - CORS middleware (origin allowlist, preflight handling)
//   - Input sanitization (strip control characters)
//   - Typed JSON response helpers
//
// Centralising these ensures every route applies the same security and
// formatting policies — no route is accidentally left unprotected.
// =============================================================================

import { NextResponse } from 'next/server';

// -----------------------------------------------------------------------------
// CORS
// -----------------------------------------------------------------------------

/**
 * Allowed origins for API requests.
 * In production, replace with your actual domain(s).
 * `localhost` and `127.0.0.1` are included for local development.
 */
const ALLOWED_ORIGINS: string[] = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // Add your production domain(s) here, e.g.:
  // 'https://syncspeak.vercel.app',
  // 'https://syncspeak.app',
];

/**
 * Check whether a request origin is in the allowlist.
 * Returns `undefined` if the origin should be denied (caller returns a CORS
 * error); returns the origin string if it's allowed.
 */
export function getAllowedOrigin(requestOrigin: string | null): string | undefined {
  if (!requestOrigin) return undefined;

  return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : undefined;
}

/**
 * Build CORS headers for an allowed origin.
 */
export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours — browsers cache preflight
    'Vary': 'Origin',
  };
}

/**
 * Handle an OPTIONS preflight request.
 * Returns a 204 No Content with CORS headers if the origin is allowed,
 * or a 403 if it's not.
 */
export function handlePreflight(requestOrigin: string | null): NextResponse {
  const allowed = getAllowedOrigin(requestOrigin);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Origin not allowed' },
      { status: 403 },
    );
  }

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(allowed),
  });
}

// -----------------------------------------------------------------------------
// Input Sanitization
// -----------------------------------------------------------------------------

/**
 * Strip non-printable characters from a string, keeping letters, numbers,
 * common punctuation, whitespace, and newlines. Removes control characters
 * that could be used for injection or that the AI doesn't need.
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return '';

  // Remove control characters (0x00–0x1F except \n \r \t) and the DEL char (0x7F)
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

// -----------------------------------------------------------------------------
// Typed JSON Response Helpers
// -----------------------------------------------------------------------------

/**
 * Return a successful JSON response with CORS headers.
 * Origin may be undefined (e.g. when the request has no allowed origin),
 * in which case no CORS headers are attached.
 */
export function jsonSuccess<T>(data: T, origin: string | undefined, status = 200): NextResponse {
  const headers: Record<string, string> = {};
  if (origin) Object.assign(headers, corsHeaders(origin));
  return NextResponse.json(data, { status, headers });
}

/**
 * Return an error JSON response with CORS headers.
 */
export function jsonError(
  error: string,
  origin: string | undefined,
  status: number,
  headers: Record<string, string> = {},
): NextResponse {
  const responseHeaders: Record<string, string> = {
    ...headers,
  };

  // Only add CORS headers if we have a valid origin
  if (origin) {
    Object.assign(responseHeaders, corsHeaders(origin));
  }

  return NextResponse.json({ error }, { status, headers: responseHeaders });
}

// -----------------------------------------------------------------------------
// IP Extraction
// -----------------------------------------------------------------------------

/**
 * Extract the client IP from a Next.js request.
 * Checks common proxy headers first, falls back to the connection remote address.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs; the first one is the original client
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return 'unknown';
}
