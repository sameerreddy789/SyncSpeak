// =============================================================================
// SyncSpeak — Semantic Matching Engine
// =============================================================================
//
// Compares spoken text (from the Speech Recognition API) against the script's
// chunks to determine which chunk the speaker is currently on. Uses Jaccard
// word-overlap similarity with a keyword-boost heuristic and searches within
// a sliding window around the last known position for O(windowSize) efficiency.
// =============================================================================

import type { ScriptChunk } from '@/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MatchResult {
  /** Index of the best-matching chunk */
  chunkIndex: number;
  /** Combined similarity + keyword-boost score (0–1+) */
  confidence: number;
  /** Keywords from the chunk that were found in the spoken text */
  matchedKeywords: string[];
}

// ---------------------------------------------------------------------------
// Text normalisation
// ---------------------------------------------------------------------------

/** Strip punctuation, collapse whitespace, and lowercase everything. */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Similarity calculation
// ---------------------------------------------------------------------------

/**
 * Compute Jaccard similarity between two texts.
 *
 * Jaccard index = |A ∩ B| / |A ∪ B|
 *
 * Returns 0 when both texts are empty (avoids division-by-zero).
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(normalizeText(text1).split(' ').filter(Boolean));
  const words2 = new Set(normalizeText(text2).split(' ').filter(Boolean));

  // Edge case: both inputs normalise to nothing
  if (words1.size === 0 && words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

// ---------------------------------------------------------------------------
// Core matching function
// ---------------------------------------------------------------------------

/**
 * Find which script chunk the speaker is currently delivering.
 *
 * Instead of scanning the entire script (which could be hundreds of chunks),
 * this function only searches a window of `windowSize` chunks around the
 * `lastKnownIndex`. This keeps the matching fast and naturally handles
 * the fact that speakers move forward through a script.
 *
 * How scoring works:
 *   1. Take the last ~50 words of `spokenText` (the most recent context).
 *   2. For each candidate chunk in the window, compute Jaccard similarity
 *      between those recent words and the chunk text.
 *   3. Award a 0.1 bonus per keyword found in the spoken text.
 *   4. The chunk with the highest total score wins.
 *
 * @param spokenText      Full transcript accumulated so far
 * @param chunks          All script chunks (in order)
 * @param lastKnownIndex  Index of the chunk the speaker was last matched to
 * @param windowSize      How many chunks ahead of lastKnownIndex to search
 * @returns               The best-matching chunk index, confidence, and keywords
 */
export function findCurrentChunk(
  spokenText: string,
  chunks: ScriptChunk[],
  lastKnownIndex: number,
  windowSize: number = 5,
): MatchResult {
  // Defensive: handle empty inputs
  if (chunks.length === 0) {
    return { chunkIndex: 0, confidence: 0, matchedKeywords: [] };
  }

  // Search window: 1 chunk behind (covers slight backtracking) + windowSize ahead
  const startIdx = Math.max(0, lastKnownIndex - 1);
  const endIdx = Math.min(chunks.length - 1, lastKnownIndex + windowSize);

  // Only consider the most recent spoken words — older text is noise
  const recentWords = spokenText.split(' ').slice(-50).join(' ');

  let bestMatch: MatchResult = {
    chunkIndex: lastKnownIndex,
    confidence: 0,
    matchedKeywords: [],
  };

  const normalizedRecent = normalizeText(recentWords);

  for (let i = startIdx; i <= endIdx; i++) {
    const chunk = chunks[i];

    // Base score: word-overlap similarity
    const similarity = calculateSimilarity(recentWords, chunk.text);

    // Keyword bonus: each matched keyword adds 0.1
    const matchedKeywords = chunk.keywords.filter((kw) =>
      normalizedRecent.includes(normalizeText(kw)),
    );
    const keywordBoost = matchedKeywords.length * 0.1;

    const totalScore = similarity + keywordBoost;

    if (totalScore > bestMatch.confidence) {
      bestMatch = {
        chunkIndex: i,
        confidence: totalScore,
        matchedKeywords,
      };
    }
  }

  return bestMatch;
}

// ---------------------------------------------------------------------------
// Recovery detection
// ---------------------------------------------------------------------------

/**
 * Check whether the speaker appears to have lost their place.
 *
 * When the match confidence drops below `threshold`, the speaker's words
 * don't align with any nearby chunk — they may need a gentle nudge to get
 * back on track.
 *
 * @param matchResult  Output of `findCurrentChunk`
 * @param threshold    Minimum acceptable confidence (default: 0.15)
 * @returns            True if recovery assistance should be shown
 */
export function isRecoveryNeeded(
  matchResult: MatchResult,
  threshold: number = 0.15,
): boolean {
  return matchResult.confidence < threshold;
}
