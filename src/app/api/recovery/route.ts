import { NextResponse } from 'next/server';
import { getRecoverySuggestion } from '@/lib/ai';
import {
  handlePreflight,
  getAllowedOrigin,
  sanitizeString,
  jsonSuccess,
  jsonError,
  getClientIp,
} from '@/lib/api-helpers';
import { rateLimit } from '@/lib/rate-limit';

// =============================================================================
// SyncSpeak — Recovery Suggestion API Route
// =============================================================================
//
// POST /api/recovery
//
// Called during a live session when the speaker loses their place.
// Returns AI-generated anchor keywords, the next point, and a transition
// sentence to help them get back on track.
//
// Backend-principle hardening applied:
//   - CORS: only requests from allowed origins are served
//   - Rate limiting: max 30 requests per IP per minute (recovery fires often)
//   - Input validation: type checks + per-field length limits
//   - Input sanitization: control characters stripped before AI
// =============================================================================

// Rate limit config: 30 requests per IP per minute (recovery is called more often)
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

// Max length for each string field
const MAX_FIELD_LENGTH = 10_000;

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
  let body: {
    currentChunkText?: unknown;
    surroundingContext?: unknown;
    spokenText?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body.', origin, 400);
  }

  const { currentChunkText, surroundingContext, spokenText } = body;

  // ── Input validation ──────────────────────────────────────────────────────
  if (!currentChunkText || typeof currentChunkText !== 'string') {
    return jsonError('currentChunkText is required and must be a string.', origin, 400);
  }

  if (!spokenText || typeof spokenText !== 'string') {
    return jsonError('spokenText is required and must be a string.', origin, 400);
  }

  if (typeof surroundingContext !== 'string') {
    return jsonError('surroundingContext must be a string.', origin, 400);
  }

  if (currentChunkText.length > MAX_FIELD_LENGTH) {
    return jsonError(
      `currentChunkText exceeds the maximum length of ${MAX_FIELD_LENGTH.toLocaleString()} characters.`,
      origin,
      413,
    );
  }

  if (spokenText.length > MAX_FIELD_LENGTH) {
    return jsonError(
      `spokenText exceeds the maximum length of ${MAX_FIELD_LENGTH.toLocaleString()} characters.`,
      origin,
      413,
    );
  }

  if (surroundingContext.length > MAX_FIELD_LENGTH) {
    return jsonError(
      `surroundingContext exceeds the maximum length of ${MAX_FIELD_LENGTH.toLocaleString()} characters.`,
      origin,
      413,
    );
  }

  // ── Sanitize inputs ───────────────────────────────────────────────────────
  const cleanChunkText = sanitizeString(currentChunkText);
  const cleanContext = sanitizeString(surroundingContext);
  const cleanSpokenText = sanitizeString(spokenText);

  // ── Generate recovery suggestion ───────────────────────────────────────────
  try {
    const suggestion = await getRecoverySuggestion(
      cleanChunkText,
      cleanContext,
      cleanSpokenText,
    );

    return jsonSuccess(suggestion, origin);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate recovery suggestion';

    const msg = message.toLowerCase();
    if (msg.includes('too many requests') || msg.includes('429') || msg.includes('rate') || msg.includes('quota')) {
      return jsonError(
        'The AI service is currently receiving too many requests.',
        origin,
        429,
      );
    }

    return jsonError(message, origin, 500);
  }
}
