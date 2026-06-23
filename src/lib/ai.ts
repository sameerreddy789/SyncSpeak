import { ScriptAnalysis, RecoveryInfo } from '@/types';
import { GEMINI_PROMPTS, MAX_SCRIPT_LENGTH } from './constants';
import { generateId as utilsGenerateId } from './utils';

// =============================================================================
// SyncSpeak — OpenRouter AI Integration
// =============================================================================

function getApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY;
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

function isRetryable(error: any): boolean {
  const msg = (error?.message ?? '').toLowerCase();
  const status = error?.status ?? error?.httpStatusCode ?? 0;

  return (
    status === 429 ||
    status === 503 ||
    status === 524 ||
    msg.includes('429') ||
    msg.includes('rate') ||
    msg.includes('quota') ||
    msg.includes('503') ||
    msg.includes('timeout')
  );
}

function friendlyError(error: any): string {
  const msg = (error?.message ?? '').toLowerCase();

  if (msg.includes('429') || msg.includes('rate') || msg.includes('quota') || msg.includes('balance')) {
    return 'The AI service is receiving too many requests or ran out of credits. Please try again in a moment.';
  }
  if (msg.includes('503') || msg.includes('unavailable')) {
    return 'The AI service is temporarily unavailable. Please try again in a few seconds.';
  }
  if (msg.includes('api key') || msg.includes('401') || msg.includes('403')) {
    return 'Invalid or missing API key. Please check your OPENROUTER_API_KEY configuration.';
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return error.message; 
  }

  return error.message || 'An unexpected error occurred while communicating with the AI.';
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (isRetryable(error)) {
      console.warn('[SyncSpeak] Retryable error — waiting 1.5 s before retry:', error.message);
      await new Promise((r) => setTimeout(r, 1500));
      return fn(); 
    }
    throw error;
  }
}

async function openRouterCompletion(systemInstruction: string, prompt: string, isJson: boolean): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set.');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3000', 
      'X-Title': 'SyncSpeak',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 8192,
      response_format: isJson ? { type: 'json_object' } : undefined
    })
  });

  if (!response.ok) {
    let errBody = '';
    try {
      errBody = await response.text();
    } catch (e) {}
    throw new Error(`OpenRouter API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function analyzeScript(scriptText: string, title: string): Promise<ScriptAnalysis> {
  if (!getApiKey()) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set.');
  }

  if (!scriptText || scriptText.trim().length === 0) {
    throw new Error('Script text cannot be empty.');
  }
  if (scriptText.length > MAX_SCRIPT_LENGTH) {
    throw new Error(`Script exceeds the maximum length of ${MAX_SCRIPT_LENGTH.toLocaleString()} characters.`);
  }

  try {
    const prompt = GEMINI_PROMPTS.analysisPrompt.replace('{{SCRIPT_TEXT}}', scriptText);

    const text = await withRetry(() =>
      withTimeout(
        openRouterCompletion(GEMINI_PROMPTS.systemPrompt, prompt, true),
        15_000,
        'Script analysis',
      ),
    );

    if (!text) {
      throw new Error('Empty response from AI');
    }

    // Sometimes OpenRouter wraps json in markdown code blocks even with response_format
    const cleanText = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const result = JSON.parse(cleanText);

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
  if (!getApiKey()) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set.');
  }

  try {
    const prompt = GEMINI_PROMPTS.recoveryPrompt
      .replace('{{CURRENT_CHUNK}}', currentChunkText)
      .replace('{{SURROUNDING_CONTEXT}}', surroundingContext)
      .replace('{{SPOKEN_TEXT}}', spokenText);

    const text = await withRetry(() =>
      withTimeout(
        openRouterCompletion(GEMINI_PROMPTS.systemPrompt, prompt, true),
        8_000,
        'Recovery suggestion',
      ),
    );

    if (!text) {
      return {
        currentTopic: 'Unknown',
        keywords: [],
        nextPoint: '',
        suggestedText: 'Just keep going.',
      };
    }

    const cleanText = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleanText);
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
