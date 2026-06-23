'use client';

// =============================================================================
// SyncSpeak — Error Boundary Component
// =============================================================================
//
// A React error boundary that catches unhandled render errors in its subtree
// and displays a styled fallback UI instead of a blank white screen. Matches
// the glassmorphism design system.
//
// This is the last line of defense — if a component throws during render,
// the ErrorBoundary catches it and gives the user a clear recovery path.
// =============================================================================

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional label shown in the fallback (e.g. "Dashboard"). */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      `[SyncSpeak] ErrorBoundary caught a render error${this.props.label ? ` in ${this.props.label}` : ''}:`,
      error,
      info.componentStack,
    );
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-0 px-4">
          <div className="flex flex-col items-center gap-6 text-center">
            {/* Error icon */}
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 backdrop-blur-lg">
              <AlertCircle className="h-10 w-10 text-red-400" />
            </div>

            <h1 className="text-2xl font-semibold text-foreground">
              Something went wrong
            </h1>
            <p className="max-w-md text-foreground-muted">
              {this.props.label
                ? `An unexpected error occurred in the ${this.props.label}.`
                : 'An unexpected error occurred.'}
              {' '}This has been logged. You can try again or go back to the dashboard.
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium border border-glass-border bg-glass-bg text-foreground transition-all duration-300 hover:bg-glass-bg-hover hover:border-glass-border-hover active:scale-[0.97]"
              >
                <RotateCcw className="h-4 w-4" />
                Try Again
              </button>
              <a
                href="/"
                className="rounded-xl px-6 py-3 text-sm font-medium bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20 transition-all duration-300 hover:bg-accent-cyan/20 hover:border-accent-cyan/40 active:scale-[0.97]"
              >
                Back to Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
