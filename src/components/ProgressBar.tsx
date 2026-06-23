// =============================================================================
// SyncSpeak — ProgressBar Component
// =============================================================================

import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ProgressBarProps {
  /** A value from 0 to 100 representing the current progress. */
  progress: number;
  /** Extra Tailwind classes for the outer container. */
  className?: string;
  /** Whether to render a "XX %" label at the end of the bar. */
  showLabel?: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ProgressBar({
  progress,
  className,
  showLabel = true,
}: ProgressBarProps) {
  // Clamp to 0-100 to avoid rendering artefacts
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn('w-full', className)}>
      {/* Label row */}
      {showLabel && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-foreground-muted">Progress</span>
          <span
            className="text-xs font-bold tabular-nums"
            style={{
              background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-purple))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {Math.round(clamped)}%
          </span>
        </div>
      )}

      {/* Track */}
      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress: ${Math.round(clamped)}%`}
      >
        {/* Filled portion */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${clamped}%`,
            background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-purple))',
            boxShadow:
              clamped > 0
                ? '0 0 12px rgba(0, 210, 255, 0.4), 0 0 24px rgba(123, 97, 255, 0.2)'
                : 'none',
          }}
        />
      </div>
    </div>
  );
}
