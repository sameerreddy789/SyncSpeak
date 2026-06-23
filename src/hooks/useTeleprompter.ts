// =============================================================================
// SyncSpeak — Teleprompter Orchestrator Hook
// =============================================================================
//
// This is the "brain" of the live session. It wires together:
//   1. useSpeechRecognition — listens to the speaker's microphone
//   2. findCurrentChunk     — determines which chunk they're speaking
//   3. Recovery API         — fetches help text when confidence drops
//
// Components consume this single hook to drive the entire teleprompter UI.
// =============================================================================

'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type {
  ScriptAnalysis,
  PresentationSession,
  RecoveryInfo,
  TeleprompterSettings,
} from '@/types';
import { useSpeechRecognition } from './useSpeechRecognition';
import { findCurrentChunk, isRecoveryNeeded } from '@/lib/semantic-matcher';
import { generateId, debounce } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Options & return types
// ---------------------------------------------------------------------------

export interface UseTeleprompterOptions {
  /** The analysed script to present */
  analysis: ScriptAnalysis;
  /** Current display / behaviour settings */
  settings: TeleprompterSettings;
}

export interface UseTeleprompterReturn {
  /** Full session state object */
  session: PresentationSession;
  /** Whether the mic is currently listening */
  isListening: boolean;
  /** Index of the chunk the speaker is currently on */
  currentChunkIndex: number;
  /** Overall progress as a 0–100 percentage */
  progress: number;
  /** True when the speaker appears to have lost their place */
  isRecoveryMode: boolean;
  /** AI-generated recovery hints (null when not in recovery mode) */
  recoveryInfo: RecoveryInfo | null;
  /** Begin a new live session */
  startSession: () => void;
  /** Pause the current session (stops mic) */
  pauseSession: () => void;
  /** Resume a paused session (restarts mic) */
  resumeSession: () => void;
  /** End the session entirely */
  endSession: () => void;
  /** Jump to a specific chunk (e.g. user clicks a line) */
  goToChunk: (index: number) => void;
  /** Accumulated final transcript */
  transcript: string;
  /** Current interim/partial transcript */
  interimTranscript: string;
  /** Latest error from speech recognition, or null */
  error: string | null;
  /** False when the browser lacks Speech API support */
  isSpeechSupported: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How many milliseconds to wait before calling the recovery API */
const RECOVERY_DEBOUNCE_MS = 2_000;

/** Minimum confidence below which recovery mode activates */
const RECOVERY_THRESHOLD = 0.15;

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useTeleprompter({
  analysis,
  // settings is currently unused but part of the API
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  settings,
}: UseTeleprompterOptions): UseTeleprompterReturn {
  const { chunks } = analysis;

  // ---- Session state -------------------------------------------------------

  const [session, setSession] = useState<PresentationSession>(() =>
    createIdleSession(analysis.id),
  );

  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryInfo, setRecoveryInfo] = useState<RecoveryInfo | null>(null);

  // Track the last matched index in a ref so the speech callback always reads
  // the freshest value without needing to re-bind.
  const lastMatchedIndexRef = useRef(0);

  // Flag to prevent recovery fetch when session isn't active
  const isActiveRef = useRef(false);

  // ---- Recovery API (debounced) -------------------------------------------

  // Create a stable debounced function via ref so it survives re-renders
  // without being torn down.
  const fetchRecoveryRef = useRef(
    debounce(async (spokenText: string, chunkIndex: number, currentChunks: typeof chunks) => {
      if (!isActiveRef.current) return;

      try {
        const currentChunk = currentChunks[chunkIndex];
        if (!currentChunk) return;

        // Build surrounding context (previous + next chunks)
        const prevChunk = chunkIndex > 0 ? currentChunks[chunkIndex - 1] : null;
        const nextChunk =
          chunkIndex < currentChunks.length - 1 ? currentChunks[chunkIndex + 1] : null;

        const surroundingContext = [
          prevChunk ? `[Previous] ${prevChunk.text}` : '',
          `[Current] ${currentChunk.text}`,
          nextChunk ? `[Next] ${nextChunk.text}` : '',
        ]
          .filter(Boolean)
          .join('\n\n');

        const response = await fetch('/api/recovery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentChunkText: currentChunk.text,
            surroundingContext,
            spokenText,
          }),
        });

        if (!response.ok) {
          console.warn('[SyncSpeak] Recovery API returned', response.status);
          return;
        }

        const data: RecoveryInfo = await response.json();
        setRecoveryInfo(data);
      } catch (err) {
        console.warn('[SyncSpeak] Recovery fetch failed:', err);
      }
    }, RECOVERY_DEBOUNCE_MS)
  );

  const debouncedFetchRecovery = fetchRecoveryRef.current;

  // Clean up the debounced function on unmount
  useEffect(() => {
    return () => {
      fetchRecoveryRef.current.cancel();
    };
  }, []);

  // ---- Speech recognition --------------------------------------------------

  const handleSpeechResult = useCallback(
    (spokenText: string, isFinal: boolean) => {
      if (!isFinal || !isActiveRef.current) return;

      // Update accumulated spoken text on the session
      setSession((prev) => ({
        ...prev,
        spokenText: spokenText,
      }));

      // Run the semantic matcher
      const matchResult = findCurrentChunk(
        spokenText,
        chunks,
        lastMatchedIndexRef.current,
      );

      // Only advance if the new match is ahead (speakers move forward)
      // or if the confidence is high enough to justify jumping back
      if (
        matchResult.chunkIndex >= lastMatchedIndexRef.current ||
        matchResult.confidence > 0.4
      ) {
        lastMatchedIndexRef.current = matchResult.chunkIndex;
        setCurrentChunkIndex(matchResult.chunkIndex);

        // Update session state
        const newProgress =
          chunks.length > 0
            ? Math.round(((matchResult.chunkIndex + 1) / chunks.length) * 100)
            : 0;

        setSession((prev) => ({
          ...prev,
          currentChunkIndex: matchResult.chunkIndex,
          progress: Math.min(newProgress, 100),
        }));
      }

      // Check if recovery mode should activate
      const needsRecovery = isRecoveryNeeded(matchResult, RECOVERY_THRESHOLD);
      setIsRecoveryMode(needsRecovery);

      if (needsRecovery) {
        debouncedFetchRecovery(spokenText, matchResult.chunkIndex, chunks);
      } else {
        // Clear recovery info when the speaker finds their way back
        setRecoveryInfo(null);
      }
    },
    [chunks, debouncedFetchRecovery], 
  );

  // ---- Session lifecycle ---------------------------------------------------

  const startSession = useCallback(() => {
    const newSession: PresentationSession = {
      id: generateId(),
      analysisId: analysis.id,
      status: 'active',
      currentChunkIndex: 0,
      startedAt: new Date(),
      completedAt: null,
      progress: 0,
      spokenText: '',
    };

    setSession(newSession);
    setCurrentChunkIndex(0);
    setIsRecoveryMode(false);
    setRecoveryInfo(null);
    lastMatchedIndexRef.current = 0;
    isActiveRef.current = true;

    resetTranscript();
    startListening();
  }, [analysis.id, resetTranscript, startListening]);

  const pauseSession = useCallback(() => {
    isActiveRef.current = false;
    stopListening();

    setSession((prev) => ({
      ...prev,
      status: 'paused',
    }));
  }, [stopListening]);

  const resumeSession = useCallback(() => {
    isActiveRef.current = true;
    startListening();

    setSession((prev) => ({
      ...prev,
      status: 'active',
    }));
  }, [startListening]);

  const endSession = useCallback(() => {
    isActiveRef.current = false;
    stopListening();
    debouncedFetchRecovery.cancel();

    setSession((prev) => ({
      ...prev,
      status: 'completed',
      completedAt: new Date(),
      progress: 100,
    }));

    setIsRecoveryMode(false);
    setRecoveryInfo(null);
  }, [stopListening, debouncedFetchRecovery]);

  const goToChunk = useCallback(
    (index: number) => {
      const clampedIndex = Math.max(0, Math.min(index, chunks.length - 1));
      lastMatchedIndexRef.current = clampedIndex;
      setCurrentChunkIndex(clampedIndex);

      const newProgress =
        chunks.length > 0
          ? Math.round(((clampedIndex + 1) / chunks.length) * 100)
          : 0;

      setSession((prev) => ({
        ...prev,
        currentChunkIndex: clampedIndex,
        progress: Math.min(newProgress, 100),
      }));

      // Reset recovery when the user manually navigates
      setIsRecoveryMode(false);
      setRecoveryInfo(null);
    },
    [chunks.length],
  );

  // ---- Derived values ------------------------------------------------------

  const progress = session.progress;

  // ---- Return --------------------------------------------------------------

  return {
    session,
    isListening,
    currentChunkIndex,
    progress,
    isRecoveryMode,
    recoveryInfo,
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    goToChunk,
    transcript,
    interimTranscript,
    error,
    isSpeechSupported,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fresh idle session (used for initial state). */
function createIdleSession(analysisId: string): PresentationSession {
  return {
    id: generateId(),
    analysisId,
    status: 'idle',
    currentChunkIndex: 0,
    startedAt: null,
    completedAt: null,
    progress: 0,
    spokenText: '',
  };
}
