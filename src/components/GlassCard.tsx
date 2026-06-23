// =============================================================================
// SyncSpeak — GlassCard Component
// =============================================================================

import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface GlassCardProps {
  children: React.ReactNode;
  /** Extra Tailwind classes merged onto the outer wrapper. */
  className?: string;
  /** When true, the card lifts and scales slightly on hover. */
  hover?: boolean;
  /** When true, a soft accent-colored glow outlines the card. */
  glow?: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function GlassCard({
  children,
  className,
  hover = false,
  glow = false,
}: GlassCardProps) {
  return (
    <div
      className={cn(
        // ── Glass foundation ──
        'relative rounded-2xl',
        'border border-glass-border',
        'bg-glass-bg',
        'backdrop-blur-[12px]',
        // ── Transition ──
        'transition-all duration-300 ease-out',
        // ── Hover lift ──
        hover && 'hover:scale-[1.02] hover:bg-glass-bg-hover hover:border-glass-border-hover',
        // ── Glow ring ──
        glow && 'shadow-[0_0_20px_rgba(0,210,255,0.15),0_0_40px_rgba(123,97,255,0.1)]',
        className,
      )}
    >
      {/* Optional glow gradient line along the top edge */}
      {glow && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, var(--accent-cyan), var(--accent-purple), transparent)',
          }}
          aria-hidden="true"
        />
      )}

      {children}
    </div>
  );
}
