// =============================================================================
// SyncSpeak — Application Constants
// =============================================================================

import type { TeleprompterSettings } from '@/types';

// -----------------------------------------------------------------------------
// App Identity
// -----------------------------------------------------------------------------

export const APP_NAME = 'SyncSpeak' as const;

// -----------------------------------------------------------------------------
// Teleprompter Defaults
// -----------------------------------------------------------------------------

export const DEFAULT_TELEPROMPTER_SETTINGS: TeleprompterSettings = {
  fontSize: 32,
  scrollSpeed: 3,
  mirrorMode: false,
  showCoaching: true,
  highlightColor: '#6366f1', // Indigo-500 — our primary accent
  theme: 'dark',
};

// -----------------------------------------------------------------------------
// Gemini Prompt Templates
// -----------------------------------------------------------------------------

export const GEMINI_PROMPTS = {
  /**
   * System-level instruction that sets the AI's persona for every request.
   */
  systemPrompt: `You are SyncSpeak Coach — an expert presentation coach AI.
Your role is to help speakers deliver confident, well-paced, and engaging presentations.

Core principles:
- Be encouraging but honest. Flag areas for improvement without being discouraging.
- Prioritise clarity over cleverness. Great presentations are easy to follow.
- Think about audience engagement — where should the speaker pause, emphasize, or change tone?
- Always respond with valid JSON when asked for structured output.
- Keep coaching notes concise and actionable — one clear instruction per note.`,

  /**
   * Prompt template for analysing a raw script into structured chunks.
   * The placeholder {{SCRIPT_TEXT}} is replaced at runtime.
   */
  analysisPrompt: `Analyse the following presentation script and break it into logical chunks for a teleprompter.

For each chunk, determine:
1. **type** — one of: "intro", "body", "conclusion", or "transition"
2. **emphasis** — true if the chunk contains a key message the speaker should stress
3. **pauseBefore** / **pauseAfter** — true if a natural pause should occur
4. **keywords** — the 2-5 most important words in the chunk (for voice-tracking)
5. **estimatedDuration** — approximate seconds to speak this chunk at a natural pace (~150 wpm)

Also generate:
- A **title** summarising the overall presentation in ≤ 8 words
- A **topicHierarchy** — a tree of logical sections, each referencing start/end chunk IDs
- **coachingNotes** — actionable delivery tips tied to specific chunks (pause, emphasize, slow-down, speed-up, breathe)

Respond ONLY with valid JSON matching this schema:
{
  "title": string,
  "chunks": [
    {
      "id": string,
      "text": string,
      "type": "intro" | "body" | "conclusion" | "transition",
      "emphasis": boolean,
      "pauseBefore": boolean,
      "pauseAfter": boolean,
      "keywords": string[],
      "estimatedDuration": number
    }
  ],
  "topicHierarchy": [
    {
      "id": string,
      "title": string,
      "startChunkId": string,
      "endChunkId": string,
      "children": []
    }
  ],
  "coachingNotes": [
    {
      "chunkId": string,
      "type": "pause" | "emphasize" | "slow-down" | "speed-up" | "breathe",
      "message": string
    }
  ]
}

--- SCRIPT START ---
{{SCRIPT_TEXT}}
--- SCRIPT END ---`,

  /**
   * Prompt template for generating recovery suggestions when the speaker
   * loses their place. Placeholders: {{CURRENT_CHUNK}}, {{SURROUNDING_CONTEXT}},
   * {{SPOKEN_TEXT}}.
   */
  recoveryPrompt: `The speaker has lost their place during a live presentation. Help them recover smoothly.

**What they were supposed to say:**
{{CURRENT_CHUNK}}

**Surrounding context (previous and upcoming chunks):**
{{SURROUNDING_CONTEXT}}

**What they actually said (from speech recognition):**
{{SPOKEN_TEXT}}

Respond ONLY with valid JSON:
{
  "currentTopic": string,       // Brief label for where they are in the talk
  "keywords": string[],         // 3-5 anchor words to jog their memory
  "nextPoint": string,          // The very next point they should make
  "suggestedText": string       // A natural sentence to get them back on track
}`,
} as const;

// -----------------------------------------------------------------------------
// Speech Recognition Configuration
// -----------------------------------------------------------------------------

export const SPEECH_RECOGNITION_CONFIG = {
  /** BCP-47 language tag */
  lang: 'en-US',
  /** Stream interim results for real-time tracking */
  interimResults: true,
  /** Keep listening after each result */
  continuous: true,
  /** Number of alternative transcriptions to request */
  maxAlternatives: 1,
} as const;

// -----------------------------------------------------------------------------
// Limits & Thresholds
// -----------------------------------------------------------------------------

/** Maximum character count for a single script input */
export const MAX_SCRIPT_LENGTH = 50_000;

/**
 * Minimum cosine-similarity score (0–1) between spoken text and a chunk's
 * keywords for the system to consider the chunk "matched" during live tracking.
 */
export const CHUNK_SIMILARITY_THRESHOLD = 0.6;
