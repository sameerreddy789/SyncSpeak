import { NextResponse } from 'next/server';
import { analyzeScript } from '@/lib/ai';
import { MAX_SCRIPT_LENGTH } from '@/lib/constants';
import {
  handlePreflight,
  getAllowedOrigin,
  sanitizeString,
  jsonSuccess,
  jsonError,
  getClientIp,
} from '@/lib/api-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { cacheGet, cacheSet } from '@/lib/cache';

// =============================================================================
// SyncSpeak — Script Analysis API Route
// =============================================================================
//
// POST /api/analyze
//
// Accepts raw script text, calls the AI to break it into structured chunks,
// and returns a ScriptAnalysis object.
//
// Backend-principle hardening applied:
//   - CORS: only requests from allowed origins are served
//   - Rate limiting: max 10 requests per IP per minute
//   - Input validation: type checks + length limits (defense in depth)
//   - Input sanitization: control characters stripped before AI
//   - Response caching: same script returns cached result within 10 min
// =============================================================================

// Rate limit config: 10 requests per IP per minute
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

// Cache config: cached analyses expire after 10 minutes
const CACHE_TTL_MS = 10 * 60 * 1_000;

// Max lengths for individual fields (beyond the script-level MAX_SCRIPT_LENGTH)
const MAX_TITLE_LENGTH = 200;

/**
 * Simple hash function for generating cache keys from script text.
 * Not cryptographically secure — just needs to be fast and have low collision
 * rate for identical inputs.
 */
function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

// Handle CORS preflight
export async function OPTIONS(request: Request) {
  return handlePreflight(request.headers.get('origin'));
}

export async function POST(req: Request) {
  const origin = getAllowedOrigin(req.headers.get('origin'));

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  const rl = rateLimit(ip, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

  if (!rl.allowed) {
    return jsonError(
      `Too many requests. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.`,
      origin,
      429,
      { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
    );
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { text?: unknown; title?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body.', origin, 400);
  }

  // ── Input validation (defense in depth — the client also validates) ────────
  const { text, title } = body;

  if (!text || typeof text !== 'string') {
    return jsonError('Script text is required and must be a string.', origin, 400);
  }

  if (typeof title !== 'string' || title.trim().length === 0) {
    return jsonError('Title is required and must be a non-empty string.', origin, 400);
  }

  if (text.length > MAX_SCRIPT_LENGTH) {
    return jsonError(
      `Script exceeds the maximum length of ${MAX_SCRIPT_LENGTH.toLocaleString()} characters.`,
      origin,
      413,
    );
  }

  if (title.length > MAX_TITLE_LENGTH) {
    return jsonError(
      `Title exceeds the maximum length of ${MAX_TITLE_LENGTH} characters.`,
      origin,
      400,
    );
  }

  // ── Sanitize inputs (strip control characters before AI processing) ──────
  const cleanText = sanitizeString(text);
  const cleanTitle = sanitizeString(title).trim() || 'Untitled Presentation';

  // ── Cache check ───────────────────────────────────────────────────────────
  const cacheKey = `analyze:${simpleHash(cleanText)}`;
  const cached = cacheGet(cacheKey, CACHE_TTL_MS);
  if (cached) {
    return jsonSuccess(cached, origin);
  }

  // ── Run analysis ─────────────────────────────────────────────────────────
  try {
    const analysis = await analyzeScript(cleanText, cleanTitle);

    // Cache the successful result
    cacheSet(cacheKey, analysis, CACHE_TTL_MS);

    return jsonSuccess(analysis, origin);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to analyze script';

    // Translate known rate-limit / quota errors to HTTP 429
    const msg = message.toLowerCase();
    if (msg.includes('too many requests') || msg.includes('429') || msg.includes('rate') || msg.includes('quota')) {
      return jsonError(
        'The AI service is currently receiving too many requests. Please try again in a moment.',
        origin,
        429,
      );
    }

    return jsonError(message, origin, 500);
  }
}
