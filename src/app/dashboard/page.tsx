'use client';

// =============================================================================
// SyncSpeak — Dashboard Page
// The workspace where users upload scripts, view analysis, and start sessions.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  Clock,
  Layers,
  Sparkles,
  Trash2,
  ExternalLink,
  AlertCircle,
  ChevronRight,
  Pause,
  Volume2,
  Wind,
  Zap,
  Gauge,
} from 'lucide-react';

import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { ScriptUploader } from '@/components/ScriptUploader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { formatDuration } from '@/lib/utils';
import type { ScriptAnalysis, TopicNode, CoachingNote } from '@/types';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const STORAGE_KEY = 'syncspeak_scripts';
const MAX_SAVED_SCRIPTS = 20;

// -----------------------------------------------------------------------------
// Animation Variants
// -----------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const slideInRight = {
  hidden: { opacity: 0, x: 40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    transition: { duration: 0.3 },
  },
};

// -----------------------------------------------------------------------------
// Saved Script Type (extends ScriptAnalysis with metadata)
// -----------------------------------------------------------------------------

interface SavedScriptEntry extends ScriptAnalysis {
  savedAt: string;
}

// -----------------------------------------------------------------------------
// Coaching Note Icon Map
// -----------------------------------------------------------------------------

const coachingIconMap: Record<CoachingNote['type'], React.ReactNode> = {
  pause: <Pause className="h-4 w-4 text-accent-cyan" />,
  emphasize: <Zap className="h-4 w-4 text-accent-purple" />,
  'slow-down': <Gauge className="h-4 w-4 text-amber-400" />,
  'speed-up': <Sparkles className="h-4 w-4 text-emerald-400" />,
  breathe: <Wind className="h-4 w-4 text-sky-400" />,
};

const coachingLabelMap: Record<CoachingNote['type'], string> = {
  pause: 'Pause',
  emphasize: 'Emphasize',
  'slow-down': 'Slow Down',
  'speed-up': 'Speed Up',
  breathe: 'Breathe',
};

// =============================================================================
// TopicTree — Recursive tree view for topic hierarchy
// =============================================================================

function TopicTree({ nodes, depth = 0 }: { nodes: TopicNode[]; depth?: number }) {
  if (!nodes || nodes.length === 0) return null;

  return (
    <ul className={depth === 0 ? 'space-y-1' : 'ml-4 mt-1 space-y-1'}>
      {nodes.map((node) => (
        <li key={node.id}>
          <div className="flex items-center gap-2 py-1">
            <ChevronRight
              className="h-3 w-3 shrink-0 text-accent-cyan"
              style={{ opacity: 0.6 + depth * 0.15 }}
            />
            <span className="text-sm text-foreground/90">{node.title}</span>
          </div>
          {node.children && node.children.length > 0 && (
            <TopicTree nodes={node.children} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

// =============================================================================
// Dashboard Page Component
// =============================================================================

export default function DashboardPage() {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────
  const [currentAnalysis, setCurrentAnalysis] = useState<ScriptAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [savedScripts, setSavedScripts] = useState<SavedScriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  // ── Load saved scripts from localStorage (hydration-safe) ──────────────
  useEffect(() => {
    setHasMounted(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: SavedScriptEntry[] = JSON.parse(raw);
        setSavedScripts(parsed);
      }
    } catch {
      // Silently handle corrupted localStorage
      console.warn('Failed to load saved scripts from localStorage.');
    }
  }, []);

  // ── Handle script analysis ─────────────────────────────────────────────
  const handleAnalyze = useCallback(async (text: string, title: string) => {
    setIsAnalyzing(true);
    setError(null);
    setCurrentAnalysis(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, title }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.error || `Analysis failed (${res.status})`
        );
      }

      const analysis: ScriptAnalysis = await res.json();
      setCurrentAnalysis(analysis);

      // Persist to localStorage
      const saved: SavedScriptEntry[] = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || '[]'
      );
      const entry: SavedScriptEntry = {
        ...analysis,
        savedAt: new Date().toISOString(),
      };
      saved.unshift(entry);
      const trimmed = saved.slice(0, MAX_SAVED_SCRIPTS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      setSavedScripts(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // ── Start a session ────────────────────────────────────────────────────
  const handleStartSession = useCallback(
    (analysis: ScriptAnalysis) => {
      sessionStorage.setItem(
        'syncspeak_session_analysis',
        JSON.stringify(analysis)
      );
      router.push('/session');
    },
    [router]
  );

  // ── Open a saved script ────────────────────────────────────────────────
  const handleOpenScript = useCallback((script: SavedScriptEntry) => {
    setCurrentAnalysis(script);
    // Scroll to the analysis section smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ── Delete a saved script ──────────────────────────────────────────────
  const handleDeleteScript = useCallback(
    (scriptId: string) => {
      const updated = savedScripts.filter((s) => s.id !== scriptId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setSavedScripts(updated);

      // If the deleted script is the one currently shown, clear it
      if (currentAnalysis?.id === scriptId) {
        setCurrentAnalysis(null);
      }
    },
    [savedScripts, currentAnalysis]
  );

  // ── Format saved-at date ───────────────────────────────────────────────
  const formatDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(dateStr));
    } catch {
      return 'Unknown date';
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        {/* ── Ambient background glow ─────────────────────────────────── */}
        <div
          className="pointer-events-none fixed inset-0 -z-10"
          aria-hidden="true"
        >
          <div
            className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full opacity-20 blur-[120px]"
            style={{ background: 'var(--accent-cyan)' }}
          />
          <div
            className="absolute right-1/4 top-40 h-[400px] w-[400px] rounded-full opacity-15 blur-[120px]"
            style={{ background: 'var(--accent-purple)' }}
          />
        </div>

        <div className="mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 lg:px-8">
          {/* ── Top Section: Page Header ──────────────────────────────── */}
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mb-12"
          >
            <h1
              className="text-4xl font-bold tracking-tight sm:text-5xl"
              style={{
                background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Your Workspace
            </h1>
            <p className="mt-3 max-w-xl text-lg text-foreground-muted">
              Upload scripts, analyze content, and launch your presentations.
            </p>
          </motion.header>

          {/* ── Error Banner ──────────────────────────────────────────── */}
          <AnimatePresence>
            {error && (
              <motion.div
                variants={scaleIn}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="mb-8 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 backdrop-blur-sm"
                role="alert"
              >
                <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="ml-auto text-sm text-red-400 transition-colors duration-300 hover:text-red-300"
                  aria-label="Dismiss error"
                >
                  Dismiss
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Main Grid: Upload + Analysis ──────────────────────────── */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid gap-8 lg:grid-cols-2"
          >
            {/* ── Left Column: Script Upload ───────────────────────── */}
            <motion.div variants={itemVariants}>
              <GlassCard className="h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-cyan-muted">
                    <Upload className="h-5 w-5 text-accent-cyan" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Upload Script
                    </h2>
                    <p className="text-sm text-foreground-muted">
                      Paste or type your presentation script
                    </p>
                  </div>
                </div>

                <ScriptUploader
                  onSubmit={handleAnalyze}
                  isAnalyzing={isAnalyzing}
                />

                {/* Loading overlay */}
                <AnimatePresence>
                  {isAnalyzing && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mt-6 flex flex-col items-center justify-center gap-4 rounded-xl border border-glass-border bg-glass-bg p-8"
                    >
                      <LoadingSpinner size="lg" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">
                          Analyzing your script…
                        </p>
                        <p className="mt-1 text-xs text-foreground-muted">
                          AI is breaking down structure, topics, and coaching cues
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            </motion.div>

            {/* ── Right Column: Analysis Results ───────────────────── */}
            <motion.div variants={itemVariants}>
              <AnimatePresence mode="wait">
                {currentAnalysis ? (
                  <motion.div
                    key="analysis"
                    variants={slideInRight}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                  >
                    <GlassCard className="h-full">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple-muted">
                            <Sparkles className="h-5 w-5 text-accent-purple" />
                          </div>
                          <div>
                            <h2 className="text-lg font-semibold text-foreground">
                              Analysis Results
                            </h2>
                            <p className="text-sm text-foreground-muted">
                              AI-powered script breakdown
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Script title */}
                      <div className="mb-6 rounded-lg border border-glass-border bg-glass-bg p-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
                          Script Title
                        </p>
                        <p className="mt-1 text-lg font-semibold text-foreground">
                          {currentAnalysis.title}
                        </p>
                      </div>

                      {/* Stats row */}
                      <div className="mb-6 grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 rounded-lg border border-glass-border bg-glass-bg p-3">
                          <Layers className="h-4 w-4 text-accent-cyan" />
                          <div>
                            <p className="text-xs text-foreground-muted">Chunks</p>
                            <p className="text-base font-semibold text-foreground">
                              {currentAnalysis.chunks.length}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-lg border border-glass-border bg-glass-bg p-3">
                          <Clock className="h-4 w-4 text-accent-purple" />
                          <div>
                            <p className="text-xs text-foreground-muted">Duration</p>
                            <p className="text-base font-semibold text-foreground">
                              {formatDuration(currentAnalysis.totalEstimatedDuration)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Topic Hierarchy */}
                      {currentAnalysis.topicHierarchy.length > 0 && (
                        <div className="mb-6">
                          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground-muted">
                            <FileText className="h-4 w-4" />
                            Topic Structure
                          </h3>
                          <div className="rounded-lg border border-glass-border bg-glass-bg p-4">
                            <TopicTree nodes={currentAnalysis.topicHierarchy} />
                          </div>
                        </div>
                      )}

                      {/* Coaching Notes */}
                      {currentAnalysis.coachingNotes.length > 0 && (
                        <div className="mb-6">
                          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground-muted">
                            <Volume2 className="h-4 w-4" />
                            Coaching Notes
                          </h3>
                          <div className="space-y-2">
                            {currentAnalysis.coachingNotes.map((note, i) => (
                              <motion.div
                                key={`${note.chunkId}-${i}`}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05, duration: 0.3 }}
                                className="flex items-start gap-3 rounded-lg border border-glass-border bg-glass-bg p-3"
                              >
                                <div className="mt-0.5 shrink-0">
                                  {coachingIconMap[note.type]}
                                </div>
                                <div className="min-w-0">
                                  <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
                                    {coachingLabelMap[note.type]}
                                  </span>
                                  <p className="mt-0.5 text-sm text-foreground/80">
                                    {note.message}
                                  </p>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Start Session CTA */}
                      <Button
                        onClick={() => handleStartSession(currentAnalysis)}
                        className="w-full"
                        variant="primary"
                        size="lg"
                      >
                        <Sparkles className="h-4 w-4" />
                        Start Session
                      </Button>
                    </GlassCard>
                  </motion.div>
                ) : (
                  /* ── Empty analysis state ───────────────────────── */
                  <motion.div
                    key="empty-analysis"
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <GlassCard className="flex h-full flex-col items-center justify-center py-16 text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-glass-border bg-glass-bg">
                        <Sparkles className="h-7 w-7 text-foreground-muted" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">
                        No Analysis Yet
                      </h3>
                      <p className="mt-2 max-w-xs text-sm text-foreground-muted">
                        Upload a script on the left and the AI will analyze its
                        structure, topics, and coaching opportunities.
                      </p>
                    </GlassCard>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>

          {/* ── Bottom Section: Saved Scripts ─────────────────────────── */}
          {hasMounted && (
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.4,
                duration: 0.6,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="mt-16"
            >
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-cyan-muted">
                  <FileText className="h-5 w-5 text-accent-cyan" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">
                    Recent Scripts
                  </h2>
                  <p className="text-sm text-foreground-muted">
                    {savedScripts.length > 0
                      ? `${savedScripts.length} script${savedScripts.length !== 1 ? 's' : ''} saved`
                      : 'Your analyzed scripts will appear here'}
                  </p>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {savedScripts.length === 0 ? (
                  /* ── Empty saved scripts state ─────────────────── */
                  <motion.div
                    key="empty-saved"
                    variants={scaleIn}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-glass-border-hover bg-glass-bg">
                        <Upload className="h-7 w-7 text-foreground-muted" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">
                        No scripts yet
                      </h3>
                      <p className="mt-2 max-w-sm text-sm text-foreground-muted">
                        Upload your first script above. Once analyzed, it will
                        appear here for quick access.
                      </p>
                    </GlassCard>
                  </motion.div>
                ) : (
                  /* ── Script cards grid ──────────────────────────── */
                  <motion.div
                    key="saved-grid"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {savedScripts.map((script, index) => (
                      <motion.div
                        key={script.id}
                        variants={itemVariants}
                        layout
                      >
                        <GlassCard
                          className="group relative flex flex-col transition-all duration-300 hover:border-glass-border-hover"
                          hover
                        >
                          {/* Card header */}
                          <h3 className="mb-2 line-clamp-2 text-base font-semibold text-foreground group-hover:text-accent-cyan transition-colors duration-300">
                            {script.title}
                          </h3>

                          {/* Meta row */}
                          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-foreground-muted">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(script.savedAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Layers className="h-3 w-3" />
                              {script.chunks.length} chunks
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(script.totalEstimatedDuration)}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="mt-auto flex items-center gap-2 pt-2">
                            <Button
                              onClick={() => handleOpenScript(script)}
                              variant="ghost"
                              size="sm"
                              className="flex-1"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open
                            </Button>
                            <Button
                              onClick={() => handleDeleteScript(script.id)}
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              aria-label={`Delete ${script.title}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </GlassCard>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
