// =============================================================================
// SyncSpeak — Speech Recognition Hook
// =============================================================================
//
// Wraps the Web Speech API in a React-friendly hook. Handles browser-prefix
// differences (SpeechRecognition vs webkitSpeechRecognition), auto-restarts
// in continuous mode, and cleans up gracefully on unmount.
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Global type augmentation — the Web Speech API is not in lib.dom.d.ts by
// default, so we declare the prefixed variant here.
// ---------------------------------------------------------------------------

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

// ---------------------------------------------------------------------------
// Hook options & return types
// ---------------------------------------------------------------------------

export interface UseSpeechRecognitionOptions {
  /** Keep listening after each result (default: true) */
  continuous?: boolean;
  /** Stream partial results as the user speaks (default: true) */
  interimResults?: boolean;
  /** BCP-47 language tag (default: 'en-US') */
  lang?: string;
  /** Fired every time a transcript arrives — interim or final */
  onResult?: (transcript: string, isFinal: boolean) => void;
  /** Fired when the Speech API reports an error */
  onError?: (error: string) => void;
}

export interface UseSpeechRecognitionReturn {
  /** Whether the microphone is currently active */
  isListening: boolean;
  /** Accumulated final transcript for the current session */
  transcript: string;
  /** Current partial/interim result (clears on each final result) */
  interimTranscript: string;
  /** Begin speech recognition */
  startListening: () => void;
  /** Stop speech recognition */
  stopListening: () => void;
  /** Clear all transcript state */
  resetTranscript: () => void;
  /** False if the browser does not support the Web Speech API */
  isSupported: boolean;
  /** Latest error message, or null */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Resolve the constructor once so we don't re-check every render
// ---------------------------------------------------------------------------

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const {
    continuous = true,
    interimResults = true,
    lang = 'en-US',
    onResult,
    onError,
  } = options;

  // ---- State ---------------------------------------------------------------

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ---- Refs ----------------------------------------------------------------

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Whether the user *intends* to be listening — used to decide whether to
  // auto-restart after the browser fires `onend` (which happens frequently
  // in continuous mode, e.g. after silence).
  const intentionallyListeningRef = useRef(false);

  // Keep latest callbacks in a ref so event handlers always use fresh values
  // without needing to tear down and recreate the recognition instance.
  const callbacksRef = useRef({ onResult, onError });
  useEffect(() => {
    callbacksRef.current = { onResult, onError };
  }, [onResult, onError]);

  // ---- Feature detection ---------------------------------------------------

  const isSupported = typeof window !== 'undefined' && getSpeechRecognition() !== null;

  // ---- Core methods --------------------------------------------------------

  const startListening = useCallback(() => {
    const Recogniser = getSpeechRecognition();
    if (!Recogniser) {
      const msg = 'Speech recognition is not supported in this browser.';
      setError(msg);
      callbacksRef.current.onError?.(msg);
      return;
    }

    // Tear down any existing instance first
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // prevent auto-restart
      recognitionRef.current.abort();
    }

    setError(null);

    const recognition = new Recogniser();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    // -- onstart -----------------------------------------------------------
    recognition.onstart = () => {
      setIsListening(true);
    };

    // -- onresult ----------------------------------------------------------
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalPart = '';
      let interimPart = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';

        if (result.isFinal) {
          finalPart += text;
        } else {
          interimPart += text;
        }
      }

      if (finalPart) {
        setTranscript((prev) => {
          const updated = prev ? `${prev} ${finalPart}` : finalPart;
          callbacksRef.current.onResult?.(updated, true);
          return updated;
        });
      }

      setInterimTranscript(interimPart);
      if (interimPart) {
        callbacksRef.current.onResult?.(interimPart, false);
      }
    };

    // -- onerror -----------------------------------------------------------
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "aborted" fires when we intentionally call .abort() — not a real error
      if (event.error === 'aborted') return;

      const errorMessage = getReadableError(event.error);
      setError(errorMessage);
      callbacksRef.current.onError?.(errorMessage);

      // Fatal errors — stop trying to listen
      if (event.error === 'not-allowed' || event.error === 'service-not-available') {
        intentionallyListeningRef.current = false;
        setIsListening(false);
      }
    };

    // -- onend -------------------------------------------------------------
    // The browser fires `onend` for many non-obvious reasons (silence timeout,
    // network blip, etc.). If the user still intends to listen, restart.
    recognition.onend = () => {
      if (intentionallyListeningRef.current && continuous) {
        try {
          recognition.start();
        } catch {
          // If start() throws (e.g. already started), just mark as stopped
          setIsListening(false);
          intentionallyListeningRef.current = false;
        }
      } else {
        setIsListening(false);
      }
    };

    // Kick off
    recognitionRef.current = recognition;
    intentionallyListeningRef.current = true;

    try {
      recognition.start();
    } catch {
      const msg = 'Failed to start speech recognition. Is the microphone in use?';
      setError(msg);
      callbacksRef.current.onError?.(msg);
      intentionallyListeningRef.current = false;
    }
  }, [continuous, interimResults, lang]);

  const stopListening = useCallback(() => {
    intentionallyListeningRef.current = false;

    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // prevent auto-restart
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // ---- Cleanup on unmount --------------------------------------------------

  useEffect(() => {
    return () => {
      intentionallyListeningRef.current = false;

      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onstart = null;
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map cryptic Speech API error codes to friendly messages.
 */
function getReadableError(errorCode: string): string {
  const errorMap: Record<string, string> = {
    'no-speech': 'No speech was detected. Please try speaking again.',
    'audio-capture': 'No microphone was found. Please check your audio settings.',
    'not-allowed': 'Microphone access was denied. Please allow microphone permission.',
    'network': 'A network error occurred during speech recognition.',
    'service-not-available': 'Speech recognition service is not available right now.',
    'bad-grammar': 'Speech grammar error. Please try again.',
    'language-not-supported': 'The selected language is not supported.',
  };

  return errorMap[errorCode] ?? `Speech recognition error: ${errorCode}`;
}
