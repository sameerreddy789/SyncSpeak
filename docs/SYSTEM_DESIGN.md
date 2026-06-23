# SyncSpeak — System Design

This document describes how SyncSpeak is architected end-to-end: the client/server
boundary, the major modules, the two core data flows, and the design decisions
behind the AI integration, persistence, and speech-tracking engine.

> For the *general* theory behind why these backend pieces exist (DNS, firewalls,
> reverse proxies, connection pooling, the browser sandbox), see
> [`BACKEND_PRINCIPLES.md`](./BACKEND_PRINCIPLES.md). This file focuses on how
> those ideas are *applied* in SyncSpeak specifically.

---

## 1. High-Level Architecture

SyncSpeak is a **Next.js 16** application built on the App Router. Like every
modern web app, it is split across two fundamentally different execution
environments:

```
┌──────────────────────────────────────┐         ┌──────────────────────────────────────┐
│           BROWSER (client)           │         │            NEXT.JS SERVER            │
│                                      │         │            (Node / serverless)       │
│  React components + hooks            │  HTTPS  │                                      │
│  Web Speech API  ───────────────────►│────────►│  /api/analyze   Route Handlers       │
│  localStorage / sessionStorage        │         │  /api/recovery                       │
│  Framer Motion / Tailwind UI         │◄────────│                                      │
│                                      │         │  lib/ai.ts      ──┐                  │
└──────────────────────────────────────┘         └────────────────────┼──────────────────┘
                                                                      │
                                            ┌─────────────────────────┴─────────────────────┐
                                            ▼                                               ▼
                                   ┌──────────────────┐                          ┌──────────────────┐
                                   │  OpenRouter API  │                          │     Firebase     │
                                   │  (AI inference)  │                          │  Auth + Firestore│
                                   └──────────────────┘                          └──────────────────┘
```

**Key boundary:** the code that runs in the browser is *sandboxed* — it can touch
the DOM, `localStorage`, and approved browser APIs (like the microphone), but it
**cannot** hold the OpenRouter API key, open a raw database socket, or bypass
CORS. All privileged work is delegated to the Next.js server routes, which act as
SyncSpeak's backend. (Why this split exists is covered in detail in
`BACKEND_PRINCIPLES.md` §4.)

---

## 2. Component Map

### 2.1 Pages (`src/app/`)

| Route | File | Responsibility |
|-------|------|----------------|
| `/` | `page.tsx` | Landing page — hero, feature cards, CTA into the dashboard. |
| `/dashboard` | `dashboard/page.tsx` | Workspace: upload a script, view the AI analysis (chunks, topic tree, coaching notes), and start a session. Also lists saved scripts. |
| `/session` | `session/page.tsx` | The teleprompter itself. Four render states: *unsupported browser*, *no script loaded*, *idle/ready*, *active session*, *completed*. This is the largest and most complex component. |
| `/api/analyze` | `api/analyze/route.ts` | Server route. Accepts raw script text, calls the AI, returns structured `ScriptAnalysis` JSON. |
| `/api/recovery` | `api/recovery/route.ts` | Server route. Called live during a session when the speaker loses their place; returns recovery hints. |

### 2.2 Hooks (`src/hooks/`)

| Hook | Responsibility |
|------|----------------|
| `useSpeechRecognition` | Wraps the browser's Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`). Handles vendor prefixing, auto-restart on silence timeout, and cleanup. Exposes `isListening`, `transcript`, `interimTranscript`. |
| `useTeleprompter` | **The brain.** Orchestrates a live session: feeds the speech transcript into the semantic matcher, advances the current chunk, computes progress, and triggers the recovery API when confidence drops. Components consume this single hook to drive the whole teleprompter UI. |

### 2.3 Libraries (`src/lib/`)

| Module | Responsibility |
|--------|----------------|
| `ai.ts` | All communication with OpenRouter. Provides `analyzeScript()` and `getRecoverySuggestion()`. Implements timeout, retry, and friendly error mapping. |
| `constants.ts` | `AI_PROMPTS` (system/analysis/recovery prompt templates), teleprompter defaults, speech-recognition config, thresholds. |
| `semantic-matcher.ts` | Pure functions that figure out *which chunk the speaker is currently on* from their spoken words (Jaccard similarity + keyword boost, sliding window). |
| `firebase.ts` | Lazy Firebase init. Reads `NEXT_PUBLIC_FIREBASE_*` env vars; exports `db`, `auth`, and an `isFirebaseConfigured` flag. Gracefully no-ops when unconfigured. |
| `firestore.ts` | CRUD for saved scripts: `saveScript`, `loadScripts`, `deleteScript`. Documents are stored per-user under `users/{uid}/scripts/{scriptId}`. |
| `AuthContext.tsx` | React context wrapping Firebase Auth (Google sign-in). Exposes `user`, `loading`, `isConfigured`. |
| `utils.ts` | Small helpers: `cn` (class joiner), `formatDuration`, `generateId`, `truncateText`, `debounce`. |

### 2.4 Types (`src/types/index.ts`)

The central type contract shared by client and server:
`ScriptChunk`, `ScriptAnalysis`, `TopicNode`, `CoachingNote`,
`PresentationSession`, `RecoveryInfo`, `TeleprompterSettings`.

---

## 3. Core Data Flows

### Flow 1 — Script Analysis (one-shot, request/response)

Happens on the dashboard when the user clicks "Analyze":

```
 Dashboard (browser)                  Next.js server                  OpenRouter
 ┌───────────────┐                   ┌──────────────────┐            ┌──────────┐
 │ ScriptUploader│   POST /api/      │ api/analyze/     │  fetch()   │          │
 │  onSubmit()   │───analyze────────►│ route.ts         │───────────►│ chat     │
 │               │   {text, title}   │                  │  system +  │ complet. │
 │               │                   │ analyzeScript()  │  user msgs │  ions    │
 │               │                   │ ai.ts            │            │          │
 │ setCurrent-   │◄──────────────────│ withRetry() +    │◄───────────│ JSON     │
 │  Analysis()   │   ScriptAnalysis  │ withTimeout()    │            │ response │
 └───────────────┘   (JSON)          └──────────────────┘            └──────────┘
        │
        ▼
   Persisted: Firestore (if signed in) OR localStorage (fallback)
```

1. The browser POSTs raw `{ text, title }` to `/api/analyze`.
2. The server's `analyzeScript()` substitutes the text into `AI_PROMPTS.analysisPrompt`
   and asks for **structured JSON** (`response_format: { type: 'json_object' }`).
3. The AI returns a chunked breakdown; the server assigns IDs and computes the
   total estimated duration, producing a `ScriptAnalysis` object.
4. The dashboard renders the analysis and saves it (Firestore or `localStorage`).

### Flow 2 — Live Session (continuous, streaming)

Happens on `/session` once the user starts presenting:

```
 Browser mic                                          Browser (client-side)
 ┌──────────┐   audio    ┌───────────────┐           ┌──────────────────────┐
 │Microphone│───────────►│Web Speech API │──────────►│ useSpeechRecognition │
 └──────────┘            │ (browser-native)│  final   │  transcript          │
                         └───────────────┘  interim  └──────────┬───────────┘
                                                                      │ onResult(transcript)
                                                                      ▼
                                            ┌─────────────────────────────────────┐
                                            │        useTeleprompter              │
                                            │                                     │
                                            │  findCurrentChunk(transcript,       │
                                            │     chunks, lastIndex)  ────────────┼─┐
                                            │     │                               │ │ sliding
                                            │     ▼                               │ │ window +
                                            │  setCurrentChunkIndex(best)         │ │ Jaccard +
                                            │  setProgress(...)                   │ │ keyword
                                            │     │                               │ │ boost
                                            │     ▼  confidence < 0.15 ?          │ │
                                            │  isRecoveryNeeded? ───yes──► debounced POST /api/recovery
                                            └─────────────────────┬───────────────┘
                                                                  │
                                                                  ▼
                                                Chunk scrollIntoView({block:'center'})
```

- Speech recognition runs **entirely in the browser**; audio never reaches our server.
- The semantic matcher runs **client-side** on each final result — cheap, O(window).
- The recovery API is **debounced** (2s) and only fires when match confidence is very low,
  so a normal talk generates zero recovery calls.

---

## 4. AI Integration Design

### Why OpenRouter?

SyncSpeak routes all inference through [OpenRouter](https://openrouter.ai) rather
than calling a single model provider directly. OpenRouter is an AI gateway /
reverse-proxy for LLMs: one OpenAI-compatible API, one key, many models. This
buys SyncSpeak:

- **Provider portability** — swap `google/gemini-2.5-flash` for any other model
  by changing one string in `ai.ts`, with no code rewrite.
- **One secret to manage** — `OPENROUTER_API_KEY` lives only on the server (see
  Security §6), never in the client bundle.
- **Unified quota/billing** across models.

### Reliability layer (`ai.ts`)

Every AI call is wrapped with three safeguards:

| Mechanism | Implementation | Handles |
|-----------|----------------|---------|
| **Timeout** | `withTimeout(promise, ms, label)` — rejects with a friendly message after N seconds | Stalled/slow upstream (15s for analysis, 8s for recovery) |
| **Retry** | `withRetry(fn)` — one retry after 1.5s if `isRetryable(error)` returns true | Transient `429`, `503`, `524`, rate-limit, quota messages |
| **Friendly errors** | `friendlyError(error)` — maps status codes/strings to user-readable text | 401/403 (bad key), 429 (rate/quota), 503 (down), timeouts |

The route handlers (`/api/analyze`, `/api/recovery`) add a final translation
layer, surfacing 429-class errors with HTTP `429` so the UI can react to them.

### Structured prompting

The system and task prompts live in `constants.ts` as `AI_PROMPTS` and request
**strict JSON** matching a documented schema (chunk type, emphasis, keywords,
estimated duration, topic hierarchy, coaching notes). Even though we set
`response_format: { type: 'json_object' }`, `ai.ts` defensively strips stray
` ```json ` markdown fences before `JSON.parse` — some upstream models wrap output
despite the format hint.

---

## 5. Persistence Strategy

SyncSpeak supports two persistence backends and picks one **transparently** based
on whether Firebase is configured:

```
                 ┌─ Firebase configured + user signed in ──► Firestore
  saveScript ────┤   (users/{uid}/scripts/{id})
                 └─ otherwise ────────────────────────────► localStorage
                     (key: 'syncspeak_scripts', capped at 20)
```

- **Firestore path** (`firestore.ts`): documents stored per-user so data is
  private and cross-device. Reads use `orderBy('createdAt', 'desc')` and convert
  Firestore `Timestamp` objects back to JS `Date`s.
- **localStorage path**: the original prototype behaviour. Lets the app work
  end-to-end with zero backend setup, which is useful for local dev and demos.

The session's *active analysis* is passed from dashboard → session via
`sessionStorage` (`syncspeak_session_analysis`), so a refresh mid-session doesn't
require a re-fetch.

This dual-path approach is a deliberate example of the "shared, centralised
state" principle (see `BACKEND_PRINCIPLES.md` §3): the *interesting* data
(scripts the user owns) moves to a centralised database once auth is available,
while a local fallback keeps the app usable offline.

---

## 6. The Speech-Tracking Engine

This is SyncSpeak's defining feature and it runs **entirely client-side**.

### The matcher (`semantic-matcher.ts`)

For each final transcript, `findCurrentChunk()` decides the current chunk:

1. **Windowing** — instead of scanning every chunk, it searches only
   `[lastKnownIndex - 1, lastKnownIndex + windowSize]`. Speakers move *forward*,
   so looking 5 chunks ahead + 1 behind covers backtracking while keeping it
   O(window), not O(script).
2. **Recent words only** — takes the last ~50 spoken words; older transcript is
   treated as noise.
3. **Score = Jaccard similarity + keyword boost.** Jaccard = `|A ∩ B| / |A ∪ B|`
   over word sets; each AI-tagged keyword found in the spoken text adds `+0.1`.
4. The highest-scoring chunk in the window wins.

### Recovery (`useTeleprompter.ts`)

If the best confidence falls below `0.15` (`RECOVERY_THRESHOLD`), the hook
considers the speaker "lost" and — after a **2s debounce** — calls
`/api/recovery` with the current chunk + surrounding context + spoken text. The
AI returns anchor keywords, the next point, and a natural transition sentence.
When the speaker's words re-align with a chunk, recovery mode clears.

The debounce matters: without it, a momentary stumble could fire dozens of AI
calls per minute. With it, recovery only triggers on a *sustained* loss of place.

---

## 7. Security Model

| Concern | Mitigation |
|---------|------------|
| **AI API key exposure** | `OPENROUTER_API_KEY` is a **server-only** env var (no `NEXT_PUBLIC_` prefix). It never ships to the browser. The client calls our own `/api/*` routes, which proxy to OpenRouter server-side. |
| **Firebase config** | Firebase keys *are* client-exposed (`NEXT_PUBLIC_`), by design — they identify the project, not authorise data. Security is enforced by **Firestore Security Rules** (to be configured in production), not key secrecy. |
| **Browser sandbox** | The Web Speech API and mic access require an explicit user permission prompt and run in the browser's sandboxed runtime. No audio reaches our servers. |
| **Input limits** | `MAX_SCRIPT_LENGTH = 50_000` chars enforced on both client (`ScriptUploader`) and server (`analyzeScript`) before any AI call. |

---

## 8. Performance Considerations

- **Matching is O(window), not O(n).** The sliding window keeps per-result work
  constant regardless of script length.
- **Recovery is debounced**, so steady speech generates zero AI calls during a session.
- **Scroll is throttled** (`setTimeout(..., 150)` in `session/page.tsx`) to avoid
  layout thrash when a speaker talks quickly.
- **Callbacks are ref-stabilized** in `useSpeechRecognition` so the recognition
  instance isn't torn down and recreated on every render.

**Known open concern:** very long (30+ minute) presentations have not been
stress-tested for UI jank from accumulated transcript state and repeated scroll.
This is tracked as a TODO.
