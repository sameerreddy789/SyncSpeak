---
name: syncspeak-backend-hardening
description: Continue the in-progress backend-hardening work on the SyncSpeak repo. Use whenever someone asks to "finish the backend changes," "continue the security/error/perf work," "apply backend principles," or pick up the pending SyncSpeak hardening tasks. Covers security tightening, robustness headers, centralized error handling, and performance caching that are partially done.
---

# SyncSpeak Backend Hardening — Continuation Guide

This skill documents **the remaining work** in a multi-part effort to apply
backend-engineering principles to the SyncSpeak codebase. Part of the work is
already merged; the rest is listed here as concrete, ordered tasks.

## Project context (read first)

SyncSpeak is an AI teleprompter app. Read these for the full picture:

- `README.md` — what the app does, tech stack, how to run.
- `docs/BACKEND_PRINCIPLES.md` — the *theory* being applied (security, CORS,
  connection pooling, why backends exist). Every change below traces back to a
  principle in this doc.
- `docs/SYSTEM_DESIGN.md` — the architecture, data flows, and component map.

Run the app: `npm run dev` (needs `OPENROUTER_API_KEY` in `.env.local`;
Firebase config is optional).

## What's already done (don't redo these)

The following have shipped and are verified (`npm run build` passes):

| Area | Done |
|------|------|
| Migration | Gemini → OpenRouter fully finished; `@google/genai` removed; `AI_PROMPTS` renamed. |
| Rate limiting | `src/lib/rate-limit.ts` created; wired into both `/api/analyze` and `/api/recovery`. |
| API helpers | `src/lib/api-helpers.ts` created (CORS allowlist, preflight, sanitization, typed responses). |
| Caching | `src/lib/cache.ts` created; `/api/analyze` caches results for 10 min. |
| Request dedup | `src/lib/ai.ts` — `deduplicatedCompletion()` prevents double-click double-calls. |
| Validation | Both API routes do server-side type + length checks (defense in depth). |
| Health check | `src/app/api/health/route.ts` created. |

## What's pending — work through these in order

The remaining tasks are grouped by principle. Do them top-to-bottom; later tasks
sometimes build on earlier ones. After **each file change**, run
`npm run build` to confirm TypeScript still compiles.

### Task 1 — Security headers + CSP (Robustness)

**File:** `next.config.ts`

Currently it's an empty config. Add a `headers()` function that returns security
headers for all routes. Apply these:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: microphone=(self)` — SyncSpeak needs the mic, but only
  from our own origin.
- `Content-Security-Policy` restricting `connect-src` to `'self'` plus
  `https://openrouter.ai` (so the page can only fetch to itself and the AI).
  Note: OpenRouter is actually called server-side, but the CSP must still allow
  the Next.js client to talk to its own `/api/*` (covered by `'self'`). Use
  `default-src 'self'` and a permissive enough `script-src`/`style-src` for
  Next.js inline styles (`'unsafe-inline'` is acceptable for style-src in a
  Next.js app; avoid it for script-src unless build complains).

Pattern in Next.js App Router:

```ts
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // ... etc
        ],
      },
    ];
  },
};
```

After saving, rebuild. If the browser console shows CSP violations on load,
loosen only the specific directive that's blocking.

### Task 2 — Firestore: friendly errors + query limit (Error Handling)

**File:** `src/lib/firestore.ts`

Two changes:

1. **Add a query limit.** `loadScripts` currently does an unbounded
   `getDocs`. Add `.limit(50)` to the query so a user with hundreds of scripts
   doesn't trigger a huge read on every dashboard load. Import `limit` from
   `firebase/firestore` and chain it after `orderBy`.

2. **Wrap each exported function in a try/catch** that translates raw Firebase
   errors into user-friendly messages. Map these Firebase error codes:
   - `permission-denied` → `"You don't have access to this data. Try signing in again."`
   - `unavailable` → `"The database is temporarily unavailable. Please try again."`
   - `not-found` → `"This script no longer exists."`
   - anything else → `"Could not complete the operation. Please try again."`

   Throw a plain `Error` with the friendly message (not the Firebase error
   object) so the UI can display it directly.

### Task 3 — Firebase production security notes (Security)

**File:** `src/lib/firebase.ts`

The `NEXT_PUBLIC_FIREBASE_*` vars are client-exposed by design (they identify
the project, not authorise data). Add a clearly-marked comment block at the top
of the file explaining:

- These keys are safe to expose — they're config, not secrets.
- **Production data security depends on Firestore Security Rules** configured in
  the Firebase Console, not on key secrecy.
- Suggest a starter rule: users can only read/write their own subcollection
  `users/{uid}/scripts/{scriptId}`. Include the rule as a code block in the
  comment.

Example rule to document:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Task 4 — AuthContext: friendly errors + requireAuth helper (Error Handling)

**File:** `src/lib/AuthContext.tsx`

1. **Friendly auth errors.** In `signInWithGoogle`, the catch block currently
   just `console.error`s and re-throws the raw Firebase error. Instead, catch
   and translate common codes:
   - `auth/popup-closed-by-user` → `"Sign-in was cancelled."`
   - `auth/network-request-failed` → `"Network error. Check your connection."`
   - `auth/cancelled-popup-request` → ignore silently (user clicked twice).

   Store the friendly message in a new `authError` state (string | null) and
   add it to the context value + `AuthContextType` interface. Reset it to
   `null` at the start of each sign-in attempt.

2. **Add a `requireAuth` helper.** Export a function that returns whether the
   app is configured AND has a signed-in user. Components currently check
   `user && isConfigured` ad-hoc; centralising it avoids drift. Add to the
   context value as `isAuthenticated: boolean`.

### Task 5 — Dashboard: surface Firestore errors to user (Error Handling)

**File:** `src/app/dashboard/page.tsx`

The `loadData` effect swallows Firestore load failures with only
`console.error`. When the cloud load fails, call `setError(...)` with a
user-facing message so the existing error banner (already in the JSX) shows it,
e.g. `"Could not load your saved scripts from the cloud. Showing locally saved scripts instead."`

Do the same in `handleDeleteScript` (the catch already sets an error — keep it)
and verify the `saveScript` failure path (already sets error — good). No new UI
needed; just stop swallowing the load error silently.

### Task 6 — Layout: wrap with ErrorBoundary (Error Handling)

**File:** `src/app/layout.tsx` and wrap the pages individually.

The `ErrorBoundary` component at `src/components/ErrorBoundary.tsx` already
exists and renders a styled fallback. Two options — pick one:

- **(Recommended) Top-level wrap.** In `layout.tsx`, wrap `{children}` inside
  `<ErrorBoundary>{children}</ErrorBoundary>` as a global safety net. Import
  from `@/components/ErrorBoundary`.

- **Per-page wrap.** In `dashboard/page.tsx` and `session/page.tsx`, wrap the
  returned JSX in `<ErrorBoundary label="Dashboard">`. Gives more specific
  fallback copy but touches more files.

Either way, after adding, rebuild and verify the app still renders.

## Verification checklist

Before declaring done, confirm each:

- [ ] `npm run build` passes with zero type errors.
- [ ] `npm run lint` — note: pre-existing `no-explicit-any` warnings exist in
      `ai.ts`/`firestore.ts` (not caused by this work). Don't try to fix those
      as part of this task unless explicitly asked.
- [ ] Manually load `/dashboard` — scripts still load (or show the new friendly
      error if Firebase is misconfigured).
- [ ] Manually run a session on `/session` — speech tracking + recovery still work.
- [ ] Hit `/api/health` — returns `{ status: 'ok', timestamp }`.
- [ ] Check the browser Network tab: API responses include the security headers
      from Task 1.
- [ ] No `console.error` left that swallows a user-facing failure silently.

## Commits

Make one commit per logical task (e.g. "feat: add security headers and CSP",
"fix: surface Firestore load errors to user"). Keep the commit message style
matching existing history (imperative mood, lowercase `feat:`/`fix:` prefix).
Don't push to `main` without confirmation if the teammate is unsure — branch
off `main` first.
