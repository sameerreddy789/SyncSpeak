// =============================================================================
// SyncSpeak — Core Type Definitions
// =============================================================================

// -----------------------------------------------------------------------------
// Script Analysis Types
// -----------------------------------------------------------------------------

/** A single chunk of the script, broken down for teleprompter display */
export interface ScriptChunk {
  id: string;
  text: string;
  type: 'intro' | 'body' | 'conclusion' | 'transition';
  emphasis: boolean;
  pauseBefore: boolean;
  pauseAfter: boolean;
  keywords: string[];
  estimatedDuration: number; // seconds
}

/** Full analysis result from Gemini, including chunks, topics, and coaching */
export interface ScriptAnalysis {
  id: string;
  title: string;
  originalText: string;
  chunks: ScriptChunk[];
  totalEstimatedDuration: number;
  createdAt: Date;
  topicHierarchy: TopicNode[];
  coachingNotes: CoachingNote[];
}

/** Hierarchical topic structure mapping chunks to logical sections */
export interface TopicNode {
  id: string;
  title: string;
  startChunkId: string;
  endChunkId: string;
  children: TopicNode[];
}

/** AI-generated coaching hint attached to a specific chunk */
export interface CoachingNote {
  chunkId: string;
  type: 'pause' | 'emphasize' | 'slow-down' | 'speed-up' | 'breathe';
  message: string;
}

// -----------------------------------------------------------------------------
// Session Types
// -----------------------------------------------------------------------------

/** Tracks the state of a live presentation session */
export interface PresentationSession {
  id: string;
  analysisId: string;
  status: 'idle' | 'active' | 'paused' | 'completed';
  currentChunkIndex: number;
  startedAt: Date | null;
  completedAt: Date | null;
  progress: number; // 0–100
  spokenText: string;
}

// -----------------------------------------------------------------------------
// Speech Recognition Types
// -----------------------------------------------------------------------------

/** A single result from the Web Speech API */
export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

// -----------------------------------------------------------------------------
// Recovery Mode
// -----------------------------------------------------------------------------

/** Context provided to the speaker when they lose their place */
export interface RecoveryInfo {
  currentTopic: string;
  keywords: string[];
  nextPoint: string;
  suggestedText: string;
}

// -----------------------------------------------------------------------------
// Dashboard Types
// -----------------------------------------------------------------------------

/** A script saved to the user's local dashboard */
export interface SavedScript {
  id: string;
  title: string;
  text: string;
  analysis: ScriptAnalysis | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  sessionCount: number;
}

// -----------------------------------------------------------------------------
// UI State
// -----------------------------------------------------------------------------

/** User-configurable teleprompter display settings */
export interface TeleprompterSettings {
  fontSize: number;
  scrollSpeed: number;
  mirrorMode: boolean;
  showCoaching: boolean;
  highlightColor: string;
  theme: 'dark' | 'light';
}
