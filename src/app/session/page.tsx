'use client';

// =============================================================================
// SyncSpeak — Session / Teleprompter Page  (Core Feature)
// =============================================================================
//
// Four states:
//   1. No Analysis Loaded   → prompt to go to dashboard
//   2. Ready                 → script preview, "Start Session"
//   3. Active                → full-screen cinematic teleprompter
//   4. Completed             → celebration stats
//
// The page ships with DEMO_ANALYSIS so it works out-of-the-box without an API
// call or other pages being wired up yet.
// =============================================================================

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Settings,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  X,
  RotateCcw,
  Volume2,
} from 'lucide-react';

import type {
  ScriptAnalysis,
  ScriptChunk,
  CoachingNote,
  PresentationSession,
  TeleprompterSettings,
  RecoveryInfo,
} from '@/types';
import { cn, formatDuration, generateId } from '@/lib/utils';
import { DEFAULT_TELEPROMPTER_SETTINGS } from '@/lib/constants';
import { useTeleprompter } from '@/hooks/useTeleprompter';

// =============================================================================
// DEMO DATA — Immediately usable sample so the page works without an API call
// =============================================================================

const DEMO_ANALYSIS: ScriptAnalysis = {
  id: 'demo-001',
  title: 'The Future of AI in Everyday Life',
  originalText: '',
  totalEstimatedDuration: 180,
  createdAt: new Date(),
  chunks: [
    {
      id: 'chunk-1',
      text: 'Good morning, everyone. Today I want to talk about something that is already reshaping our world — artificial intelligence. Not the science-fiction version, but the quiet revolution happening right now, in our pockets, our homes, and our workplaces.',
      type: 'intro',
      emphasis: true,
      pauseBefore: false,
      pauseAfter: true,
      keywords: ['artificial intelligence', 'revolution', 'reshaping'],
      estimatedDuration: 20,
    },
    {
      id: 'chunk-2',
      text: 'Think about the last time you asked your phone a question, or got a movie recommendation that felt eerily perfect. That was AI. It is woven so deeply into our daily routines that we barely notice it anymore.',
      type: 'body',
      emphasis: false,
      pauseBefore: false,
      pauseAfter: false,
      keywords: ['phone', 'recommendation', 'daily routines'],
      estimatedDuration: 18,
    },
    {
      id: 'chunk-3',
      text: 'But here is the key question — and I want you to really sit with this for a moment: If AI can already do so much, what happens when it gets ten times better? What does that mean for our jobs, our creativity, and our sense of purpose?',
      type: 'body',
      emphasis: true,
      pauseBefore: true,
      pauseAfter: true,
      keywords: ['key question', 'jobs', 'creativity', 'purpose'],
      estimatedDuration: 22,
    },
    {
      id: 'chunk-4',
      text: 'Let me share three areas where the change will be most profound. First, healthcare. AI models are already diagnosing diseases from medical images with accuracy that matches — and sometimes surpasses — experienced radiologists.',
      type: 'body',
      emphasis: false,
      pauseBefore: false,
      pauseAfter: false,
      keywords: ['healthcare', 'diagnosing', 'radiologists', 'accuracy'],
      estimatedDuration: 20,
    },
    {
      id: 'chunk-5',
      text: 'Second, education. Imagine a world where every student has a personal AI tutor that adapts to their learning pace, identifies gaps instantly, and never loses patience. That world is not a decade away — it is being built right now.',
      type: 'body',
      emphasis: true,
      pauseBefore: false,
      pauseAfter: true,
      keywords: ['education', 'AI tutor', 'learning pace', 'built right now'],
      estimatedDuration: 22,
    },
    {
      id: 'chunk-6',
      text: 'Third, creative work. AI is not here to replace artists. It is here to give every person on the planet the ability to express ideas visually, musically, and narratively — regardless of technical skill. The barrier to creation is vanishing.',
      type: 'body',
      emphasis: true,
      pauseBefore: false,
      pauseAfter: true,
      keywords: ['creative work', 'artists', 'express ideas', 'barrier'],
      estimatedDuration: 24,
    },
    {
      id: 'chunk-7',
      text: 'So here is my challenge to each of you. Do not fear this change — shape it. Learn how these tools work. Ask hard questions about fairness and access. And above all, remember: technology is only as good as the humans who guide it. Thank you.',
      type: 'conclusion',
      emphasis: true,
      pauseBefore: true,
      pauseAfter: false,
      keywords: ['challenge', 'shape', 'fairness', 'guide', 'thank you'],
      estimatedDuration: 24,
    },
  ],
  topicHierarchy: [
    {
      id: 'topic-1',
      title: 'Introduction — The Quiet AI Revolution',
      startChunkId: 'chunk-1',
      endChunkId: 'chunk-2',
      children: [],
    },
    {
      id: 'topic-2',
      title: 'Three Areas of Profound Change',
      startChunkId: 'chunk-3',
      endChunkId: 'chunk-6',
      children: [],
    },
    {
      id: 'topic-3',
      title: 'Call to Action',
      startChunkId: 'chunk-7',
      endChunkId: 'chunk-7',
      children: [],
    },
  ],
  coachingNotes: [
    { chunkId: 'chunk-1', type: 'emphasize', message: 'Start strong — make eye contact, let the opening land.' },
    { chunkId: 'chunk-3', type: 'pause', message: 'Pause here. Let the audience absorb the question.' },
    { chunkId: 'chunk-3', type: 'slow-down', message: 'Slow down through the list of "jobs, creativity, purpose".' },
    { chunkId: 'chunk-5', type: 'emphasize', message: 'Hit "built right now" with conviction — this is your strongest line.' },
    { chunkId: 'chunk-6', type: 'pause', message: 'Brief pause after "vanishing" for dramatic effect.' },
    { chunkId: 'chunk-7', type: 'emphasize', message: 'Land the close. Slow pace, eye contact, then a confident "Thank you."' },
    { chunkId: 'chunk-7', type: 'breathe', message: 'Take a breath before the final sentence.' },
  ],
};

// =============================================================================
// Highlight colour presets for the settings panel
// =============================================================================

const HIGHLIGHT_PRESETS = [
  { name: 'Cyan', value: '#00d2ff' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'White', value: '#ffffff' },
  { name: 'Purple', value: '#7b61ff' },
] as const;

// =============================================================================
// Coaching note icon helper
// =============================================================================

type CoachingType = CoachingNote['type'];

function coachingIcon(type: CoachingType) {
  switch (type) {
    case 'pause':
      return '⏸';
    case 'emphasize':
      return '🎯';
    case 'slow-down':
      return '🐢';
    case 'speed-up':
      return '⚡';
    case 'breathe':
      return '🫁';
    default:
      return '💡';
  }
}

function coachingColor(type: CoachingType) {
  switch (type) {
    case 'pause':
      return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    case 'emphasize':
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
    case 'slow-down':
      return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
    case 'speed-up':
      return 'bg-green-500/20 text-green-300 border-green-500/30';
    case 'breathe':
      return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    default:
      return 'bg-white/10 text-white/70 border-white/20';
  }
}

// =============================================================================
// Framer Motion variants
// =============================================================================

const fadeVariant = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
  exit: { opacity: 0, y: -12, transition: { duration: 0.3 } },
};

const overlayVariant = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.25 } },
};

const panelVariant = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as const } },
  exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.25 } },
};

const confettiParticles = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  delay: Math.random() * 0.8,
  size: 4 + Math.random() * 6,
  color: ['#00d2ff', '#7b61ff', '#22c55e', '#eab308', '#f43f5e'][i % 5],
  rotation: Math.random() * 360,
}));

// =============================================================================
// Page Component
// =============================================================================

export default function SessionPage() {
  const router = useRouter();

  // ---------------------------------------------------------------------------
  // State — Analysis
  // ---------------------------------------------------------------------------
  const [analysis, setAnalysis] = useState<ScriptAnalysis>(DEMO_ANALYSIS);
  const [hasLoaded, setHasLoaded] = useState(false);

  // ---------------------------------------------------------------------------
  // State — Teleprompter Settings
  // ---------------------------------------------------------------------------
  const [settings, setSettings] = useState<TeleprompterSettings>(DEFAULT_TELEPROMPTER_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // ---------------------------------------------------------------------------
  // The Teleprompter Brain
  // ---------------------------------------------------------------------------
  const teleprompter = useTeleprompter({ analysis, settings });
  const {
    session,
    isListening: isMicActive,
    currentChunkIndex,
    progress,
    isRecoveryMode,
    recoveryInfo,
    startSession: hookStartSession,
    pauseSession: togglePause,
    resumeSession,
    endSession,
    goToChunk: jumpToChunk,
    transcript,
    interimTranscript,
    error: speechError,
    isSpeechSupported,
  } = teleprompter;

  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------
  const chunkRefs = useRef<(HTMLDivElement | null)[]>([]);
  const teleprompterRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------
  const chunks = useMemo(() => analysis.chunks ?? [], [analysis]);
  const isActive = session.status === 'active';
  const isPaused = session.status === 'paused';
  const isCompleted = session.status === 'completed';
  const isIdle = session.status === 'idle';

  const notesForChunk = useCallback(
    (chunkId: string): CoachingNote[] =>
      analysis.coachingNotes.filter((n) => n.chunkId === chunkId) ?? [],
    [analysis],
  );

  // Which topic are we in?
  const currentTopic = useMemo(() => {
    if (!analysis || chunks.length === 0) return null;
    return (
      analysis.topicHierarchy.find((t) => {
        const startIdx = chunks.findIndex((c) => c.id === t.startChunkId);
        const endIdx = chunks.findIndex((c) => c.id === t.endChunkId);
        return currentChunkIndex >= startIdx && currentChunkIndex <= endIdx;
      }) ?? null
    );
  }, [analysis, chunks, currentChunkIndex]);

  // ---------------------------------------------------------------------------
  // Load analysis from sessionStorage
  // ---------------------------------------------------------------------------
  useEffect(() => {
    try {
      // Fixed: The dashboard sets 'syncspeak_session_analysis', not 'syncspeak_analysis'
      const stored = sessionStorage.getItem('syncspeak_session_analysis');
      if (stored) {
        const parsed = JSON.parse(stored) as ScriptAnalysis;
        setAnalysis(parsed);
      }
    } catch {
      // Parsing failed — fall through to demo
    }
    setHasLoaded(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Timer — counts elapsed seconds while the session is active
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive) {
      interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  // ---------------------------------------------------------------------------
  // Auto-scroll to current chunk
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isActive && !isPaused) return;
    
    // Throttle scrolling slightly to prevent visual jitter when speaking quickly
    const timer = setTimeout(() => {
      chunkRefs.current[currentChunkIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 150);
    
    return () => clearTimeout(timer);
  }, [currentChunkIndex, isActive, isPaused]);

  // ---------------------------------------------------------------------------
  // Keyboard navigation (arrow keys to advance/go back)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (showSettings) return; // Don't navigate while settings is open
      if (!isActive && !isPaused) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(currentChunkIndex + 1, chunks.length - 1);
        if (next === chunks.length - 1 && currentChunkIndex === chunks.length - 1) {
          endSession();
        } else {
          jumpToChunk(next);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        jumpToChunk(Math.max(currentChunkIndex - 1, 0));
      } else if (e.key === ' ') {
        e.preventDefault();
        if (isPaused) {
          resumeSession();
        } else {
          togglePause();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, isPaused, currentChunkIndex, chunks.length, showSettings, jumpToChunk, togglePause, resumeSession, endSession]);

  // ---------------------------------------------------------------------------
  // Session actions
  // ---------------------------------------------------------------------------
  const startSession = useCallback(() => {
    setElapsed(0);
    hookStartSession();
  }, [hookStartSession]);

  const restartSession = useCallback(() => {
    setElapsed(0);
    teleprompter.endSession();
    // A small delay to let the hook reset fully before starting again
    setTimeout(() => {
      hookStartSession();
    }, 100);
  }, [teleprompter, hookStartSession]);

  const goToPrevChunk = useCallback(() => {
    jumpToChunk(Math.max(currentChunkIndex - 1, 0));
  }, [currentChunkIndex, jumpToChunk]);

  const goToNextChunk = useCallback(() => {
    const next = Math.min(currentChunkIndex + 1, chunks.length - 1);
    if (next === chunks.length - 1 && currentChunkIndex === chunks.length - 1) {
      endSession();
    } else {
      jumpToChunk(next);
    }
  }, [currentChunkIndex, chunks.length, endSession, jumpToChunk]);

  const toggleMic = useCallback(() => {
    if (isMicActive) {
      togglePause();
    } else {
      if (isPaused) {
        resumeSession();
      } else {
        hookStartSession();
      }
    }
  }, [isMicActive, isPaused, togglePause, resumeSession, hookStartSession]);

  // ---------------------------------------------------------------------------
  // Settings updaters
  // ---------------------------------------------------------------------------
  const updateSetting = useCallback(<K extends keyof TeleprompterSettings>(
    key: K,
    value: TeleprompterSettings[K],
  ) => {
    setSettings((s) => ({ ...s, [key]: value }));
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER: State 0 — Unsupported Browser
  // ═══════════════════════════════════════════════════════════════════════════

  if (hasLoaded && !isSpeechSupported) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-0 px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-6 text-center"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 backdrop-blur-lg">
            <AlertCircle className="h-10 w-10 text-red-400" />
          </div>

          <h1 className="text-2xl font-semibold text-foreground">
            Browser Not Supported
          </h1>
          <p className="max-w-md text-foreground-muted">
            SyncSpeak relies on the Web Speech API for real-time speech tracking. 
            Currently, this is only supported in Google Chrome, Microsoft Edge, and Safari. 
            Please open this application in a supported browser.
          </p>

          <button
            onClick={() => router.push('/')}
            className={cn(
              'mt-2 rounded-xl px-8 py-3 text-sm font-medium',
              'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20',
              'transition-all duration-300',
              'hover:bg-accent-cyan/20 hover:border-accent-cyan/40 hover:shadow-[var(--glow-cyan)]',
              'active:scale-[0.97]',
            )}
          >
            Go to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER: State 1 — No Analysis Loaded
  // ═══════════════════════════════════════════════════════════════════════════

  if (hasLoaded && !analysis) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-0 px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-6 text-center"
        >
          {/* Floating icon */}
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-glass-border bg-glass-bg backdrop-blur-lg">
            <AlertCircle className="h-10 w-10 text-foreground-muted" />
          </div>

          <h1 className="text-2xl font-semibold text-foreground">
            No script loaded
          </h1>
          <p className="max-w-md text-foreground-muted">
            Head back to the dashboard to paste or upload your script. SyncSpeak will
            analyse it and prepare your teleprompter session.
          </p>

          <button
            onClick={() => router.push('/')}
            className={cn(
              'mt-2 rounded-xl px-8 py-3 text-sm font-medium',
              'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20',
              'transition-all duration-300',
              'hover:bg-accent-cyan/20 hover:border-accent-cyan/40 hover:shadow-[var(--glow-cyan)]',
              'active:scale-[0.97]',
            )}
          >
            Go to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER: State 4 — Session Completed
  // ═══════════════════════════════════════════════════════════════════════════

  if (isCompleted) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden bg-surface-0 px-4">
        {/* Confetti particles */}
        {confettiParticles.map((p) => (
          <motion.div
            key={p.id}
            className="pointer-events-none absolute rounded-sm"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              left: `${p.x}%`,
              top: '-10px',
            }}
            initial={{ y: -20, rotate: 0, opacity: 1 }}
            animate={{
              y: ['0vh', '110vh'],
              rotate: [0, p.rotation + 360],
              opacity: [1, 1, 0.5, 0],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              delay: p.delay,
              ease: 'easeIn',
              repeat: Infinity,
              repeatDelay: Math.random() * 2,
            }}
          />
        ))}

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const }}
          className="relative z-10 flex flex-col items-center gap-6 text-center"
        >
          {/* Celebration icon */}
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-accent-cyan/30 bg-accent-cyan/10 shadow-[var(--glow-cyan)] backdrop-blur-lg">
            <span className="text-5xl">🎉</span>
          </div>

          <h1 className="text-3xl font-bold text-foreground">
            Session Complete!
          </h1>
          <p className="max-w-md text-foreground-muted">
            Great work on your presentation. Here are your session stats.
          </p>

          {/* Stats grid */}
          <div className="mt-2 grid grid-cols-2 gap-4">
            {[
              { label: 'Duration', value: formatDuration(elapsed) },
              { label: 'Chunks Covered', value: `${chunks.length}/${chunks.length}` },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={fadeVariant}
                className="flex flex-col items-center gap-1 rounded-xl border border-glass-border bg-glass-bg px-6 py-4 backdrop-blur-lg"
              >
                <span className="text-2xl font-bold text-accent-cyan">{stat.value}</span>
                <span className="text-xs text-foreground-muted">{stat.label}</span>
              </motion.div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={restartSession}
              className={cn(
                'flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium',
                'border border-glass-border bg-glass-bg text-foreground',
                'transition-all duration-300',
                'hover:bg-glass-bg-hover hover:border-glass-border-hover',
                'active:scale-[0.97]',
              )}
            >
              <RotateCcw className="h-4 w-4" />
              Restart
            </button>
            <button
              onClick={() => router.push('/')}
              className={cn(
                'rounded-xl px-6 py-3 text-sm font-medium',
                'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20',
                'transition-all duration-300',
                'hover:bg-accent-cyan/20 hover:border-accent-cyan/40 hover:shadow-[var(--glow-cyan)]',
                'active:scale-[0.97]',
              )}
            >
              Back to Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER: State 2 — Ready (Idle, analysis loaded, session not started)
  // ═══════════════════════════════════════════════════════════════════════════

  if (isIdle) {
    return (
      <div className="flex min-h-screen flex-col bg-surface-0">
        {/* Navbar placeholder — shown only when not in active session */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-glass-border bg-surface-0/80 px-6 backdrop-blur-lg">
          <span className="text-lg font-bold tracking-tight text-foreground">
            Sync<span className="text-accent-cyan">Speak</span>
          </span>
          <button
            onClick={() => router.push('/')}
            className="text-sm text-foreground-muted transition-colors duration-300 hover:text-foreground"
          >
            ← Dashboard
          </button>
        </header>

        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
          {/* Script title & overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col gap-2"
          >
            <h1 className="text-3xl font-bold text-foreground">
              {analysis.title}
            </h1>
            <p className="text-foreground-muted">
              Review your script below, then start the session when ready.
            </p>
          </motion.div>

          {/* Stats cards */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            {[
              { label: 'Chunks', value: chunks.length.toString(), icon: '📝' },
              { label: 'Est. Duration', value: formatDuration(analysis.totalEstimatedDuration), icon: '⏱️' },
              { label: 'Topics', value: analysis.topicHierarchy.length.toString(), icon: '📌' },
              { label: 'Coaching Notes', value: analysis.coachingNotes.length.toString(), icon: '💡' },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="flex flex-col gap-1 rounded-xl border border-glass-border bg-glass-bg p-4 backdrop-blur-lg"
              >
                <span className="text-lg">{stat.icon}</span>
                <span className="text-xl font-bold text-foreground">{stat.value}</span>
                <span className="text-xs text-foreground-muted">{stat.label}</span>
              </div>
            ))}
          </motion.div>

          {/* Script preview — scrollable chunk list */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col gap-3 rounded-2xl border border-glass-border bg-glass-bg p-6 backdrop-blur-lg"
          >
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-foreground-muted">
              Script Preview
            </h2>
            <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto pr-2">
              {chunks.map((chunk, i) => {
                const notes = notesForChunk(chunk.id);
                return (
                  <motion.div
                    key={chunk.id}
                    custom={i}
                    initial="hidden"
                    animate="visible"
                    variants={fadeVariant}
                    className={cn(
                      'rounded-xl border border-glass-border bg-surface-1/60 p-4 transition-colors duration-300',
                      'hover:border-glass-border-hover hover:bg-surface-2/40',
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-md bg-accent-cyan/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-cyan">
                        {chunk.type}
                      </span>
                      <span className="text-[10px] text-foreground-muted">
                        ~{chunk.estimatedDuration}s
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/80">
                      {chunk.text}
                    </p>
                    {notes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {notes.map((note, ni) => (
                          <span
                            key={ni}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]',
                              coachingColor(note.type),
                            )}
                          >
                            {coachingIcon(note.type)} {note.message}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Start Session CTA */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="flex justify-center pb-12"
          >
            <button
              onClick={startSession}
              className={cn(
                'group relative flex items-center gap-3 rounded-2xl px-12 py-5 text-lg font-semibold',
                'bg-gradient-to-r from-accent-cyan/20 to-accent-purple/20',
                'border border-accent-cyan/30 text-foreground',
                'transition-all duration-500',
                'hover:from-accent-cyan/30 hover:to-accent-purple/30',
                'hover:border-accent-cyan/50 hover:shadow-[var(--glow-combo)]',
                'active:scale-[0.97]',
              )}
            >
              <Play className="h-6 w-6 text-accent-cyan transition-transform duration-300 group-hover:scale-110" />
              Start Session
              {/* Subtle glow behind button */}
              <span className="absolute inset-0 -z-10 rounded-2xl bg-accent-cyan/5 blur-xl transition-all duration-500 group-hover:bg-accent-cyan/10 group-hover:blur-2xl" />
            </button>
          </motion.div>

          {/* Keyboard shortcut hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center text-xs text-foreground-muted/50"
          >
            During the session: ← → to navigate chunks · Space to pause · Esc for settings
          </motion.p>
        </main>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER: State 3 — Active / Paused Session (The Cinematic Teleprompter)
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div
      className="relative flex h-screen flex-col overflow-hidden bg-surface-0"
      style={{ transform: settings.mirrorMode ? 'scaleX(-1)' : 'none' }}
    >
      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-20 flex flex-col border-b border-glass-border bg-surface-0/90 backdrop-blur-xl"
      >
        {/* Progress bar — fills the full width of the top bar */}
        <div className="h-1 w-full bg-glass-bg">
          <motion.div
            className="h-full rounded-r-full"
            style={{
              background: `linear-gradient(90deg, ${settings.highlightColor}, var(--accent-purple))`,
              boxShadow: `0 0 12px ${settings.highlightColor}40`,
            }}
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between px-4 py-2.5">
          {/* Left: Timer + Progress % */}
          <div className="flex items-center gap-4">
            <span className="font-mono text-sm font-medium text-foreground-muted">
              {formatDuration(elapsed)}
            </span>
            <span className="text-xs text-foreground-muted/60">
              {progress}% complete
            </span>
            {currentTopic && (
              <span className="hidden rounded-md bg-accent-purple/10 px-2 py-0.5 text-[10px] text-accent-purple sm:inline-block">
                {currentTopic.title}
              </span>
            )}
          </div>

          {/* Center: Navigation controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevChunk}
              disabled={currentChunkIndex === 0}
              className={cn(
                'rounded-lg p-2 transition-all duration-300',
                'text-foreground-muted hover:bg-glass-bg-hover hover:text-foreground',
                'disabled:opacity-30 disabled:pointer-events-none',
              )}
              title="Previous chunk (←)"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              onClick={togglePause}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300',
                isPaused
                  ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/25 hover:bg-accent-cyan/25'
                  : 'bg-glass-bg text-foreground-muted border border-glass-border hover:bg-glass-bg-hover hover:text-foreground',
              )}
              title="Pause / Resume (Space)"
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>

            <button
              onClick={goToNextChunk}
              disabled={currentChunkIndex === chunks.length - 1}
              className={cn(
                'rounded-lg p-2 transition-all duration-300',
                'text-foreground-muted hover:bg-glass-bg-hover hover:text-foreground',
                'disabled:opacity-30 disabled:pointer-events-none',
              )}
              title="Next chunk (→)"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>

          {/* Right: Mic indicator, Settings, End */}
          <div className="flex items-center gap-3">
            {/* Mic status */}
            <button
              onClick={toggleMic}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all duration-300',
                isMicActive
                  ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20',
              )}
              title={isMicActive ? 'Mic is on — click to mute' : 'Mic is off — click to enable'}
            >
              {isMicActive ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                  </span>
                  <Mic className="h-3.5 w-3.5" />
                </>
              ) : (
                <MicOff className="h-3.5 w-3.5" />
              )}
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-lg p-2 text-foreground-muted transition-all duration-300 hover:bg-glass-bg-hover hover:text-foreground"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>

            {/* End session */}
            <button
              onClick={endSession}
              className={cn(
                'rounded-xl px-3.5 py-1.5 text-xs font-medium',
                'border border-red-500/20 bg-red-500/10 text-red-400',
                'transition-all duration-300',
                'hover:bg-red-500/20 hover:border-red-500/30',
              )}
            >
              End
            </button>
          </div>
        </div>
      </motion.header>

      {/* ── MAIN TELEPROMPTER AREA ──────────────────────────────────────── */}
      <div
        ref={teleprompterRef}
        className="relative flex-1 overflow-y-auto scroll-smooth"
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* Top / bottom gradient fades for cinematic depth */}
        <div className="pointer-events-none sticky top-0 z-10 h-24 bg-gradient-to-b from-surface-0 to-transparent" />

        <div className="mx-auto max-w-3xl px-6 py-8">
          {/* Paused overlay */}
          <AnimatePresence>
            {isPaused && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center"
              >
                <div className="rounded-2xl border border-glass-border bg-surface-0/80 px-10 py-6 backdrop-blur-xl">
                  <p className="text-2xl font-semibold text-foreground-muted">
                    ⏸ Paused
                  </p>
                  <p className="mt-1 text-sm text-foreground-muted/60">
                    Press Space or click Resume to continue
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chunk list */}
          <div className="flex flex-col gap-6">
            {chunks.map((chunk, i) => {
              const isCurrent = i === currentChunkIndex;
              const isPast = i < currentChunkIndex;
              const isFuture = i > currentChunkIndex;
              const notes = settings.showCoaching ? notesForChunk(chunk.id) : [];

              return (
                <motion.div
                  key={chunk.id}
                  ref={(el) => { chunkRefs.current[i] = el; }}
                  onClick={() => jumpToChunk(i)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{
                    opacity: isCurrent ? 1 : isPast ? 0.3 : 0.7,
                    y: 0,
                    scale: isCurrent ? 1 : 0.97,
                  }}
                  transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const }}
                  className={cn(
                    'cursor-pointer rounded-2xl border p-6 transition-all duration-500',
                    isCurrent && 'border-transparent',
                    isPast && 'border-transparent',
                    isFuture && 'border-glass-border',
                    isCurrent && 'bg-glass-bg backdrop-blur-lg',
                    !isCurrent && 'hover:bg-glass-bg/50',
                  )}
                  style={{
                    ...(isCurrent
                      ? {
                          borderColor: `${settings.highlightColor}40`,
                          boxShadow: `0 0 30px ${settings.highlightColor}15, inset 0 0 30px ${settings.highlightColor}05`,
                        }
                      : {}),
                  }}
                >
                  {/* Coaching notes BEFORE text (pause markers etc.) */}
                  {notes
                    .filter((n) => n.type === 'pause' || n.type === 'breathe')
                    .map((note, ni) => (
                      <div
                        key={`pre-${ni}`}
                        className={cn(
                          'mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs',
                          coachingColor(note.type),
                        )}
                      >
                        {coachingIcon(note.type)} {note.type === 'pause' ? 'PAUSE' : 'BREATHE'}
                      </div>
                    ))}

                  {/* Chunk text */}
                  <p
                    className={cn(
                      'leading-relaxed transition-all duration-500',
                      isCurrent ? 'text-foreground font-medium' : 'text-foreground/60',
                    )}
                    style={{
                      fontSize: isCurrent
                        ? `${settings.fontSize}px`
                        : `${Math.max(settings.fontSize - 6, 14)}px`,
                      lineHeight: 1.7,
                    }}
                  >
                    {/* If the chunk has emphasis coaching, underline the text */}
                    {chunk.emphasis && isCurrent ? (
                      <span
                        style={{
                          textDecorationLine: 'underline',
                          textDecorationColor: settings.highlightColor,
                          textDecorationThickness: '2px',
                          textUnderlineOffset: '6px',
                        }}
                      >
                        {chunk.text}
                      </span>
                    ) : (
                      chunk.text
                    )}
                  </p>

                  {/* Coaching notes AFTER text (emphasize, slow-down, etc.) */}
                  {notes.filter((n) => n.type !== 'pause' && n.type !== 'breathe').length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {notes
                        .filter((n) => n.type !== 'pause' && n.type !== 'breathe')
                        .map((note, ni) => (
                          <span
                            key={`post-${ni}`}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]',
                              coachingColor(note.type),
                            )}
                          >
                            {coachingIcon(note.type)} {note.message}
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Current chunk indicator line */}
                  {isCurrent && (
                    <motion.div
                      layoutId="chunk-indicator"
                      className="mt-4 h-0.5 w-16 rounded-full"
                      style={{ backgroundColor: settings.highlightColor }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Spacer so the last chunk can scroll to center */}
          <div className="h-[40vh]" />
        </div>

        {/* Bottom gradient fade */}
        <div className="pointer-events-none sticky bottom-0 z-10 -mt-24 h-24 bg-gradient-to-t from-surface-0 to-transparent" />
      </div>

      {/* ── BOTTOM PANEL — Transcript & Recovery ────────────────────────── */}
      <motion.div
        initial={{ y: 60 }}
        animate={{ y: 0 }}
        className="relative z-20 border-t border-glass-border bg-surface-1/90 backdrop-blur-xl"
      >
        {/* Toggle handle */}
        <button
          onClick={() => setShowTranscript((s) => !s)}
          className="flex w-full items-center justify-center gap-2 py-2 text-xs text-foreground-muted transition-colors duration-300 hover:text-foreground"
        >
          {showTranscript ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          {showTranscript ? 'Hide transcript' : 'Show transcript'}
          {isMicActive && (
            <span className="relative ml-1 flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
            </span>
          )}
        </button>

        <AnimatePresence>
          {showTranscript && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-4">
                {/* Recovery mode banner */}
                {recoveryInfo && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
                  >
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-300">
                      <AlertCircle className="h-4 w-4" />
                      Recovery Mode — {recoveryInfo.currentTopic}
                    </div>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {recoveryInfo.keywords.map((kw) => (
                        <span
                          key={kw}
                          className="rounded-md bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-amber-200/80">
                      <strong>Next point:</strong> {recoveryInfo.nextPoint}
                    </p>
                    <p className="mt-1 text-xs italic text-amber-200/60">
                      &ldquo;{recoveryInfo.suggestedText}&rdquo;
                    </p>
                  </motion.div>
                )}

                {/* Transcript display */}
                <div className="flex items-start gap-3">
                  <Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted/50" />
                  <div className="flex-1">
                    <p className="min-h-[2rem] text-sm leading-relaxed text-foreground/60">
                      {transcript ? (
                        <>
                          {transcript}{' '}
                          <span className="italic text-foreground-muted">{interimTranscript}</span>
                        </>
                      ) : interimTranscript ? (
                        <span className="italic text-foreground-muted">{interimTranscript}</span>
                      ) : (
                        <span className="italic text-foreground-muted/40">
                          {isMicActive
                            ? 'Listening... start speaking to see your transcript here.'
                            : 'Microphone is off. Enable it to see live transcription.'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── SETTINGS PANEL (Modal Overlay) ──────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <>
            {/* Backdrop */}
            <motion.div
              variants={overlayVariant}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />

            {/* Panel */}
            <motion.div
              variants={panelVariant}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-2xl border border-glass-border bg-surface-1/95 p-6 shadow-2xl backdrop-blur-xl sm:inset-x-auto"
            >
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  Teleprompter Settings
                </h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="rounded-lg p-1.5 text-foreground-muted transition-colors duration-300 hover:bg-glass-bg-hover hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-col gap-6">
                {/* Font Size slider */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-foreground-muted">Font Size</label>
                    <span className="font-mono text-sm text-accent-cyan">{settings.fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={16}
                    max={72}
                    step={2}
                    value={settings.fontSize}
                    onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-glass-bg accent-accent-cyan"
                  />
                  <div className="flex justify-between text-[10px] text-foreground-muted/50">
                    <span>16px</span>
                    <span>72px</span>
                  </div>
                </div>

                {/* Mirror Mode toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-foreground">Mirror Mode</span>
                    <p className="text-xs text-foreground-muted/60">
                      Flip text horizontally for traditional teleprompters
                    </p>
                  </div>
                  <button
                    onClick={() => updateSetting('mirrorMode', !settings.mirrorMode)}
                    className={cn(
                      'relative h-7 w-12 rounded-full transition-colors duration-300',
                      settings.mirrorMode ? 'bg-accent-cyan/30' : 'bg-glass-bg',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-6 w-6 rounded-full bg-foreground shadow transition-all duration-300',
                        settings.mirrorMode ? 'left-[calc(100%-1.625rem)]' : 'left-0.5',
                      )}
                    />
                  </button>
                </div>

                {/* Show Coaching toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-foreground">Show Coaching</span>
                    <p className="text-xs text-foreground-muted/60">
                      Display inline coaching notes and cues
                    </p>
                  </div>
                  <button
                    onClick={() => updateSetting('showCoaching', !settings.showCoaching)}
                    className={cn(
                      'relative h-7 w-12 rounded-full transition-colors duration-300',
                      settings.showCoaching ? 'bg-accent-cyan/30' : 'bg-glass-bg',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-6 w-6 rounded-full bg-foreground shadow transition-all duration-300',
                        settings.showCoaching ? 'left-[calc(100%-1.625rem)]' : 'left-0.5',
                      )}
                    />
                  </button>
                </div>

                {/* Highlight Color */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-foreground-muted">Highlight Color</label>
                  <div className="flex gap-2">
                    {HIGHLIGHT_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => updateSetting('highlightColor', preset.value)}
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-xl border-2 transition-all duration-300',
                          settings.highlightColor === preset.value
                            ? 'border-foreground scale-110'
                            : 'border-transparent hover:border-glass-border-hover',
                        )}
                        style={{ backgroundColor: `${preset.value}25` }}
                        title={preset.name}
                      >
                        <span
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: preset.value }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Keyboard shortcuts reference */}
              <div className="mt-6 rounded-xl border border-glass-border bg-glass-bg/50 p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
                  Keyboard Shortcuts
                </p>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-foreground-muted/70">
                  <span>← →  Navigate chunks</span>
                  <span>Space  Pause / Resume</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
