import type { NextConfig } from "next";

// =============================================================================
// Security headers (applied to every route — see BACKEND_PRINCIPLES.md §4.1
// "browser sandbox" and SYSTEM_DESIGN.md §7 "Security Model").
//
// The browser sandbox keeps the client away from the OS/filesystem, but it
// doesn't protect the *rendered page* from injection, clickjacking, or
// permission abuse. These headers close that gap:
//   - X-Content-Type-Options: stop MIME-sniffing attacks.
//   - X-Frame-Options: forbid embedding (anti-clickjacking).
//   - Referrer-Policy: leak only the origin to third parties.
//   - Permissions-Policy: mic access allowed only from our own origin.
//   - Content-Security-Policy: the page may only load/connect to trusted sources.
// =============================================================================

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // SyncSpeak needs the microphone, but only from its own origin — never a
  // framed/embedded one. Same reasoning as the CSP below.
  { key: "Permissions-Policy", value: "microphone=(self)" },
  {
    key: "Content-Security-Policy",
    // - default-src 'self': deny everything by default.
    // - script-src: Next.js (esp. Turbopack dev) injects inline scripts for
    //   HMR/react-refresh; allow them in dev via 'unsafe-inline' + the HMR
    //   websocket. In production the bundle has no inline scripts, so this is
    //   safe to tighten later.
    // - style-src: Tailwind/CSS-in-JS injects inline styles → allow 'unsafe-inline'.
    // - img-src + font-src: Next/Image + Google Fonts.
    // - connect-src: 'self' (our /api/*) + OpenRouter + Turbopack dev websocket.
    // - frame-ancestors 'none': belt-and-braces with X-Frame-Options.
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // OpenRouter is actually called server-side, but the page still needs
      // 'self' to reach /api/*. The HMR websocket is localhost dev only.
      "connect-src 'self' https://openrouter.ai ws://localhost:3000 ws://127.0.0.1:3000",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
