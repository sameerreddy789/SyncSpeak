import { GoogleGenAI } from '@google/genai';
import { ScriptAnalysis, RecoveryInfo } from '@/types';
import { GEMINI_PROMPTS, MAX_SCRIPT_LENGTH } from './constants';
import { generateId as utilsGenerateId } from './utils';

// =============================================================================
// SyncSpeak — Gemini AI Integration
// =============================================================================
//
// Wraps the Google GenAI client with:
//   - Retry logic (1 retry with exponential back-off for 429 / 503)
//   - Request timeouts (15 s analysis, 8 s recovery)
//   - Human-readable error mapping
// =============================================================================

// ---------------------------------------------------------------------------
// Client initialisation
// ---------------------------------------------------------------------------

const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

// ---------------------------------------------------------------------------
// Helpers — retry, timeout, error mapping
// ---------------------------------------------------------------------------

/** Wrap a promise with a timeout. Rejects with a friendly message on expiry. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms / 1000}s. Please try again.`)),
      ms,
    );
    promise
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

/** Check if an error is retryable (rate-limit or transient server error). */
function isRetryable(error: any): boolean {
  const msg = (error?.message ?? '').toLowerCase();
  const status = error?.status ?? error?.httpStatusCode ?? 0;

  return (
    status === 429 ||
    status === 503 ||
    msg.includes('429') ||
    msg.includes('rate') ||
    msg.includes('quota') ||
    msg.includes('resource exhausted') ||
    msg.includes('503') ||
    msg.includes('unavailable')
  );
}

/** Map raw Gemini errors to user-friendly messages. */
function friendlyError(error: any): string {
  const msg = (error?.message ?? '').toLowerCase();

  if (msg.includes('429') || msg.includes('rate') || msg.includes('quota') || msg.includes('resource exhausted')) {
    return 'The AI is receiving too many requests right now. Please wait a moment and try again.';
  }
  if (msg.includes('503') || msg.includes('unavailable')) {
    return 'The AI service is temporarily unavailable. Please try again in a few seconds.';
  }
  if (msg.includes('api key') || msg.includes('401') || msg.includes('403')) {
    return 'Invalid or missing API key. Please check your GEMINI_API_KEY configuration.';
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return error.message; // already friendly from withTimeout
  }

  return error.message || 'An unexpected error occurred while communicating with the AI.';
}

/**
 * Execute `fn` with a single retry on retryable errors.
 * The retry waits 1.5 s before the second attempt.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (isRetryable(error)) {
      console.warn('[SyncSpeak] Retryable error — waiting 1.5 s before retry:', error.message);
      await new Promise((r) => setTimeout(r, 1500));
      return fn(); // single retry — don't catch this one
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function analyzeScript(scriptText: string, title: string): Promise<ScriptAnalysis> {
  if (!ai) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }

  // Input validation
  if (!scriptText || scriptText.trim().length === 0) {
    throw new Error('Script text cannot be empty.');
  }
  if (scriptText.length > MAX_SCRIPT_LENGTH) {
    throw new Error(`Script exceeds the maximum length of ${MAX_SCRIPT_LENGTH.toLocaleString()} characters.`);
  }

  try {
    const prompt = GEMINI_PROMPTS.analysisPrompt.replace('{{SCRIPT_TEXT}}', scriptText);

    const response = await withRetry(() =>
      withTimeout(
        ai!.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
          config: {
            systemInstruction: GEMINI_PROMPTS.systemPrompt,
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
        15_000,
        'Script analysis',
      ),
    );

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from AI');
    }

    const result = JSON.parse(text);

    // Assign IDs to chunks
    const chunksWithIds = result.chunks.map((chunk: any) => ({
      ...chunk,
      id: utilsGenerateId(),
    }));

    return {
      id: utilsGenerateId(),
      title,
      originalText: scriptText,
      chunks: chunksWithIds,
      totalEstimatedDuration: chunksWithIds.reduce(
        (sum: number, c: any) => sum + (c.estimatedDuration || 0),
        0,
      ),
      createdAt: new Date(),
      topicHierarchy: result.topicHierarchy || [],
      coachingNotes: result.coachingNotes || [],
    };
  } catch (error: any) {
    console.error('Error analyzing script:', error);
    throw new Error(friendlyError(error));
  }
}

export async function getRecoverySuggestion(
  currentChunkText: string,
  surroundingContext: string,
  spokenText: string,
): Promise<RecoveryInfo> {
  if (!ai) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }

  try {
    const prompt = GEMINI_PROMPTS.recoveryPrompt
      .replace('{{CURRENT_CHUNK}}', currentChunkText)
      .replace('{{SURROUNDING_CONTEXT}}', surroundingContext)
      .replace('{{SPOKEN_TEXT}}', spokenText);

    const response = await withRetry(() =>
      withTimeout(
        ai!.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
          config: {
            systemInstruction: GEMINI_PROMPTS.systemPrompt,
            temperature: 0.4,
            responseMimeType: 'application/json',
          },
        }),
        8_000,
        'Recovery suggestion',
      ),
    );

    const text = response.text;
    if (!text) {
      return {
        currentTopic: 'Unknown',
        keywords: [],
        nextPoint: '',
        suggestedText: 'Just keep going.',
      };
    }

    return JSON.parse(text);
  } catch (error) {
    console.error('Error getting recovery info:', error);
    return {
      currentTopic: 'Connection Lost',
      keywords: [],
      nextPoint: 'Resume from your last remembered point',
      suggestedText: 'Take a breath and continue when ready.',
    };
  }
}
