# 🎙️ SyncSpeak: AI Presentation Copilot

## 📖 What is SyncSpeak?

SyncSpeak is an intelligent teleprompter and presentation copilot that helps speakers maintain eye contact, deliver content naturally, and never lose their place.

Traditional teleprompters scroll at a fixed speed, which completely breaks down if a speaker improvises, pauses, or skips a line. **SyncSpeak solves this by actively listening to the speaker and automatically synchronizing the script's scroll position with their real-time speech.**

Powered by **OpenRouter** (model: `google/gemini-2.5-flash`), SyncSpeak doesn't just scroll — it deeply understands the script. It breaks speeches into natural chunks, identifies key topics, and provides real-time coaching insights (when to pause, emphasize, or breathe). When a speaker drifts off-script, an AI-powered **recovery mode** suggests a transition sentence to get them smoothly back on track.

---

## 🏗️ Current Stage: Prototype / Alpha

The core UI/UX, AI integrations, backend persistence, and the live speech-tracking engine are all built and functional.

### ✅ What's Working

**Presentation & UI**
- **Premium UI/UX:** A highly interactive, dark-mode, glassmorphism-based interface built with React, Next.js 16, TailwindCSS v4, and Framer Motion.
- **Landing page & workspace dashboard:** Paste or drag-drop a script and get it instantly analyzed.
- **Session teleprompter:** A full-screen, distraction-free teleprompter with cinematic scrolling, ambient fades, and a completion celebration.

**AI Integration**
- **Script analysis:** The backend breaks a raw script into logical chunks, classifies each (intro / body / conclusion / transition), tags emphasis and pauses, extracts voice-tracking keywords, estimates durations, builds a topic hierarchy, and generates actionable coaching notes.
- **Smart recovery:** When a speaker loses their place, the AI returns anchor keywords, the next point, and a natural sentence to resume with.

**Live Speech Tracking**
- **Real-time sync:** A `useSpeechRecognition` hook wraps the browser Web Speech API, and a client-side **semantic matcher** (Jaccard similarity + keyword boost, sliding window) figures out which chunk the speaker is currently on and auto-scrolls to it.
- **Graceful handling:** Speakers can skip ahead or backtrack; the matcher recovers without frantic scrolling, and recovery calls are debounced so a steady talk generates zero extra AI calls.

**Backend & Persistence**
- **Authentication:** Firebase Auth with Google sign-in (gracefully no-ops when unconfigured).
- **Cloud storage:** Saved scripts persist to **Firestore** (`users/{uid}/scripts/{id}`) when a user is signed in, with a transparent `localStorage` fallback for local/demo use.

**Robustness**
- **Resilient AI calls:** Every AI request is wrapped with a **timeout** (15s analysis / 8s recovery), a one-shot **retry** on transient errors (`429`/`503`/`524`/rate-limit/quota), and **friendly error mapping** surfaced to the UI.
- **Teleprompter customization:** Adjustable font size, mirror mode (for physical teleprompters), coaching-note toggle, and highlight-color presets.

---

## 🚀 What's Left (TODOs)

The remaining work is about hardening and polish rather than new foundations:

- [ ] **Real-world speech testing:** Validate the Web Speech API + semantic matcher across accents, pacing, and improvisation; tune `RECOVERY_THRESHOLD` and the match window.
- [ ] **Long-session performance:** Stress-test 30+ minute presentations for UI jank from accumulated transcript state and repeated scroll.
- [ ] **Firestore Security Rules:** Lock down per-user document access in production (currently relying on the open dev config).
- [ ] **Mobile polish:** The teleprompter is desktop-first; small-screen layout needs refinement.

---

## 🏛️ System Design & Architecture

SyncSpeak is a Next.js (App Router) app split across a **sandboxed browser client** and a **Node/serverless backend**, following the principle that privileged, heavy, or shared-state work belongs on the server.

- The **client** renders the UI, captures microphone input via the Web Speech API, and runs the lightweight semantic matcher.
- The **server** (`/api/analyze`, `/api/recovery`) holds the `OPENROUTER_API_KEY`, proxies AI calls (avoiding CORS and key exposure), and reads/writes Firestore.

Deep dives:

- 📐 **[System Design](./docs/SYSTEM_DESIGN.md)** — architecture diagrams, the component map, the two core data flows (analysis + live session), the AI reliability layer, persistence strategy, and the speech-tracking engine.
- 🧠 **[Backend Principles](./docs/BACKEND_PRINCIPLES.md)** — what a backend is, how a request travels (DNS → firewall → reverse proxy → app), and the four reasons backend logic must not live in the frontend — each mapped to a SyncSpeak decision.

---

## 💻 Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router, Turbopack), React 19 |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4, custom CSS variables (glassmorphism design system) |
| **Animation** | Framer Motion |
| **Icons** | Lucide React |
| **AI** | OpenRouter (`google/gemini-2.5-flash`) via server-side `fetch` |
| **Backend / Data** | Next.js Route Handlers, Firebase Auth + Firestore |
| **Speech** | Web Speech API (browser-native, client-side) |

---

## 🛠️ How to Run Locally

1. **Clone the repository.**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Create a `.env.local`` file** in the root directory. The **only required** variable is the AI key:

   ```env
   # Required — AI inference
   OPENROUTER_API_KEY=sk-or-v1-your-key-here
   ```

   Firebase is **optional**. Without it the app still works fully (auth is disabled and scripts fall back to `localStorage`). To enable cloud auth + sync, add your Firebase web config:

   ```env
   # Optional — Firebase (Auth + Firestore)
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
5. **Open [http://localhost:3000](http://localhost:3000)** in your browser.

> ⚠️ **Speech recognition note:** The live teleprompter relies on the Web Speech API, which is currently supported in **Chrome, Edge, and Safari**. Other browsers will show an "unsupported" screen on `/session`.

---

## 🔧 For Contributors — Backend Hardening (In Progress)

The backend-principle work (security headers, error handling, caching, validation)
is **partially complete** and ongoing. If you're picking up this work, read the
continuation guide first:

➡️ **[`.agents/skills/syncspeak-backend-hardening/SKILL.md`](./.agents/skills/syncspeak-backend-hardening/SKILL.md)**

It lists what's already done, the remaining tasks (in order), exact files to
change, code patterns to follow, and a verification checklist.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts      # AI script analysis endpoint
│   │   └── recovery/route.ts     # AI recovery-suggestion endpoint
│   ├── dashboard/page.tsx        # Workspace: upload + analyze + saved scripts
│   ├── session/page.tsx          # The teleprompter (core feature)
│   ├── page.tsx                  # Landing page
│   └── layout.tsx
├── components/                   # Button, GlassCard, Navbar, ScriptUploader, …
├── hooks/
│   ├── useSpeechRecognition.ts   # Web Speech API wrapper
│   └── useTeleprompter.ts        # Session orchestrator (the "brain")
├── lib/
│   ├── ai.ts                     # OpenRouter integration + retry/timeout
│   ├── constants.ts              # AI prompts, defaults, thresholds
│   ├── semantic-matcher.ts       # Spoken-text → chunk matching
│   ├── firebase.ts / firestore.ts
│   └── AuthContext.tsx
└── types/index.ts                # Shared type contracts
```
