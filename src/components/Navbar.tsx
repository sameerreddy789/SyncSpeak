'use client';

// =============================================================================
// SyncSpeak — Navbar Component
// =============================================================================

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';
import { Menu, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';

// -----------------------------------------------------------------------------
// Navigation items
// -----------------------------------------------------------------------------

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Use Cases', href: '#use-cases' },
] as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading, isConfigured, signInWithGoogle, signOut } = useAuth();

  return (
    <nav
      className={cn(
        'fixed top-0 inset-x-0 z-50',
        'bg-surface-0/70 backdrop-blur-xl',
        'border-b border-glass-border',
      )}
    >
      {/* Gradient glow line */}
      <div
        className="absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--accent-cyan), var(--accent-purple), transparent)',
          opacity: 0.4,
        }}
        aria-hidden="true"
      />

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* ── Logo ── */}
        <Link
          href="/"
          className="flex items-center gap-2 group transition-opacity duration-300 hover:opacity-80"
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              background:
                'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
            }}
          >
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">
            {APP_NAME}
          </span>
        </Link>

        {/* ── Desktop links ── */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={cn(
                'text-sm font-medium text-foreground-muted',
                'transition-colors duration-300',
                'hover:text-foreground',
              )}
            >
              {link.label}
            </a>
          ))}

          {!loading && isConfigured && !user && (
            <button
              onClick={signInWithGoogle}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-5 py-2.5',
                'text-sm font-semibold text-white',
                'bg-glass-bg border border-glass-border',
                'transition-all duration-300',
                'hover:bg-glass-bg-hover hover:border-glass-border-hover',
                'active:scale-[0.97]',
              )}
            >
              Sign In
            </button>
          )}

          {(!isConfigured || user) && (
            <Link
              href="/dashboard"
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-5 py-2.5',
                'text-sm font-semibold text-white',
                'transition-all duration-300',
                'hover:brightness-110 hover:shadow-lg hover:shadow-accent-cyan/25',
                'active:scale-[0.97]',
              )}
              style={{
                background:
                  'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
              }}
            >
              {user ? 'Dashboard' : 'Get Started'}
            </Link>
          )}

          {user && (
            <button
              onClick={signOut}
              className="text-sm font-medium text-foreground-muted transition-colors duration-300 hover:text-red-400"
            >
              Sign Out
            </button>
          )}
        </div>

        {/* ── Mobile hamburger ── */}
        <button
          className="inline-flex items-center justify-center rounded-lg p-2 text-foreground-muted transition-colors hover:bg-glass-bg hover:text-foreground md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* ── Mobile menu ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-glass-border bg-surface-0/95 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-4">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="rounded-lg px-4 py-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-glass-bg hover:text-foreground"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <Link
                href="/dashboard"
                className="mt-2 rounded-xl px-4 py-3 text-center text-sm font-semibold text-white transition-all duration-300 hover:brightness-110"
                style={{
                  background:
                    'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                }}
                onClick={() => setMobileOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
