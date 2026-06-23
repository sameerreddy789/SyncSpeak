// =============================================================================
// SyncSpeak — LoadingSpinner Component
// =============================================================================

import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface LoadingSpinnerProps {
  /** Controls the diameter of the spinner ring. */
  size?: 'sm' | 'md' | 'lg';
  /** Optional label rendered below the spinner for screen readers and sighted users. */
  text?: string;
}

// Size map — each entry is [ring diameter, border width]
const sizeMap = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-12 w-12 border-4',
} as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3" role="status">
      {/* Spinner ring — gradient border achieved by a conic-gradient mask */}
      <div
        className={cn(
          sizeMap[size],
          'rounded-full',
          'border-transparent',
          'animate-spin',
        )}
        style={{
          borderImage:
            'conic-gradient(from 0deg, transparent 25%, var(--accent-cyan), var(--accent-purple)) 1',
          borderRadius: '9999px',
          /* borderImage resets border-radius, so we use a clip-path fallback */
          clipPath: 'circle(50%)',
          WebkitMask:
            'radial-gradient(closest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
          mask:
            'radial-gradient(closest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
          /* Simpler alternative that works across all browsers: */
          borderTopColor: 'var(--accent-cyan)',
          borderRightColor: 'var(--accent-purple)',
          borderBottomColor: 'transparent',
          borderLeftColor: 'transparent',
          animation: 'spin 0.8s linear infinite',
        }}
        aria-hidden="true"
      />

      {/* Accessible label — always present for screen readers */}
      {text ? (
        <span className="text-sm text-foreground-muted">{text}</span>
      ) : (
        <span className="sr-only">Loading…</span>
      )}
    </div>
  );
}
