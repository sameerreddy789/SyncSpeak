'use client';

// =============================================================================
// SyncSpeak — Footer Component
// =============================================================================

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

// -----------------------------------------------------------------------------
// Data
// -----------------------------------------------------------------------------

const footerLinks = [
  { label: 'About', href: '/about' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'GitHub', href: 'https://github.com', external: true },
] as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function Footer() {
  return (
    <footer
      className="mt-auto border-t border-glass-border bg-surface-1/60 backdrop-blur-sm"
      role="contentinfo"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-8 sm:flex-row sm:justify-between">
        {/* ── Left: Brand + Badge ──────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 sm:items-start">
          {/* Logo */}
          <span
            className="text-lg font-bold tracking-tight"
            style={{
              background:
                'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {APP_NAME}
          </span>

          {/* "Built with AI" badge */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-glass-bg px-3 py-1 text-[11px] font-medium text-foreground-muted">
            <Sparkles size={12} className="text-accent-purple" aria-hidden="true" />
            Built with AI
          </span>
        </div>

        {/* ── Centre: Nav links ────────────────────────────────────── */}
        <nav aria-label="Footer navigation">
          <ul className="flex items-center gap-6">
            {footerLinks.map((link) => (
              <li key={link.label}>
                {'external' in link && link.external ? (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-foreground-muted transition-colors duration-300 hover:text-accent-cyan focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    href={link.href}
                    className="text-sm text-foreground-muted transition-colors duration-300 hover:text-accent-cyan focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                  >
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* ── Right: Copyright ─────────────────────────────────────── */}
        <p className="text-xs text-foreground-muted/60">
          © 2024 {APP_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
