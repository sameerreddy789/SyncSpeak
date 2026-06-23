'use client';

// =============================================================================
// SyncSpeak — Button Component
// =============================================================================

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ButtonProps {
  children: ReactNode;
  /** Visual style of the button. */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Controls padding and font size. */
  size?: 'sm' | 'md' | 'lg';
  /** Disables the button and applies reduced opacity. */
  disabled?: boolean;
  /** Shows a spinning loader and disables interaction. */
  loading?: boolean;
  /** Click handler. */
  onClick?: () => void;
  /** Extra Tailwind classes merged onto the <button>. */
  className?: string;
  /** An icon rendered before the children text. */
  icon?: ReactNode;
  /** HTML button type attribute. */
  type?: 'button' | 'submit' | 'reset';
}

// -----------------------------------------------------------------------------
// Style maps
// -----------------------------------------------------------------------------

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-5 py-2.5 text-sm gap-2 rounded-xl',
  lg: 'px-7 py-3.5 text-base gap-2.5 rounded-xl',
} as const;

// We use inline styles for the gradient bg on "primary" because Tailwind v4
// can't reference multiple CSS custom-property colors in a bg-gradient class.
const variantClasses = {
  primary: [
    'text-white font-semibold',
    'shadow-lg shadow-accent-cyan/20',
    'hover:shadow-xl hover:shadow-accent-cyan/30',
    'hover:brightness-110',
    'active:scale-[0.97]',
  ].join(' '),
  secondary: [
    'bg-glass-bg text-foreground',
    'border border-glass-border',
    'backdrop-blur-[12px]',
    'hover:bg-glass-bg-hover hover:border-glass-border-hover',
    'active:scale-[0.97]',
  ].join(' '),
  ghost: [
    'text-foreground-muted',
    'hover:text-foreground hover:bg-glass-bg',
    'active:scale-[0.97]',
  ].join(' '),
} as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  className,
  icon,
  type = 'button',
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        // ── Base ──
        'relative inline-flex items-center justify-center',
        'font-medium leading-none',
        'transition-all duration-300 ease-out',
        'select-none cursor-pointer',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan',
        // ── Size ──
        sizeClasses[size],
        // ── Variant ──
        variantClasses[variant],
        // ── Disabled state ──
        isDisabled && 'pointer-events-none opacity-50',
        className,
      )}
      style={
        variant === 'primary'
          ? {
              background:
                'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
            }
          : undefined
      }
      aria-busy={loading}
    >
      {/* Spinner replaces the icon when loading */}
      {loading ? (
        <Loader2
          className="animate-spin"
          size={size === 'sm' ? 14 : size === 'md' ? 16 : 20}
          aria-hidden="true"
        />
      ) : icon ? (
        <span className="shrink-0" aria-hidden="true">{icon}</span>
      ) : null}

      {children}
    </button>
  );
}
