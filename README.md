# 🎙️ SyncSpeak: AI Presentation Copilot

## 📖 What is SyncSpeak?

SyncSpeak is an intelligent teleprompter and presentation assistance platform designed to help speakers maintain eye contact, deliver content naturally, and never lose their place. 

Traditional teleprompters scroll at a fixed speed, which completely breaks down if a speaker improvises, pauses, or skips a line. **SyncSpeak solves this by actively listening to the speaker and automatically synchronizing the script's scroll position with their real-time speech.**

Powered by Google's **Gemini 3.1 Flash Lite**, SyncSpeak doesn't just scroll—it deeply understands the script. It breaks down speeches into natural chunks, identifies key topics, and provides real-time coaching insights (like when to pause, emphasize, or breathe).

---

## 🏗️ Current Stage: Prototype / Alpha

The project is currently in the **functional prototype phase**. The core UI/UX and primary AI integrations have been built.

**What's working right now:**
* **Premium UI/UX:** A highly interactive, dark-mode, glassmorphism-based interface built with React, Next.js 16, TailwindCSS, and Framer Motion.
* **Workspace Dashboard:** Users can paste their scripts and get them instantly analyzed.
* **AI Analysis Integration:** The backend seamlessly connects to the Gemini API to analyze uploaded scripts, breaking them into logical chunks, generating estimated durations, and adding coaching notes.
* **Session Teleprompter:** A full-screen, distraction-free teleprompter mode that displays the analyzed script chunks and coaching cues.
* **Local Persistence:** Scripts are temporarily saved to the browser's `localStorage` so users don't lose their work upon refresh.

---

## 🚀 What Needs to Be Done Next (TODOs)

While the UI and AI analysis are functioning, several critical functional pieces need to be connected and polished before production:

### 1. Live Speech Recognition & Tracking
- [ ] **Test & Refine Web Speech API:** The `useSpeechRecognition` hook needs to be heavily tested in real-time environments to ensure it accurately captures spoken words.
- [ ] **Semantic Matching:** The logic that matches the "currently spoken text" to the "script chunks" needs to be bulletproof. If a user skips a paragraph or goes off-script, the system must recover gracefully without frantically scrolling.
- [ ] **Smart Recovery:** Implement the AI-powered fallback where, if a user gets completely lost, Gemini suggests a transition sentence to get them back on track.

### 2. Backend & Database (Firebase)
- [ ] **Authentication:** Add Firebase Auth so users can create accounts and log in securely.
- [ ] **Cloud Storage:** Move from `localStorage` to Firebase Firestore so users can access their saved scripts across different devices.

### 3. Stability & Error Handling
- [ ] **API Rate Limits:** Implement proper error handling and fallback UI if the Gemini API hits rate limits or quotas during a live presentation.
- [ ] **Performance:** Ensure that the constant transcription matching doesn't cause UI lag during long (30+ minute) presentations.

### 4. Customization & Settings
- [ ] **Teleprompter Controls:** Allow users to manually adjust text size, contrast, and manual scroll overrides in case they want to disable the AI tracking mid-speech.

---

## 💻 Tech Stack
* **Frontend:** Next.js (App Router), React 19, Tailwind CSS, Framer Motion, Lucide Icons.
* **AI Provider:** Google Gemini API (gemini-3.1-flash-lite).
* **Styling:** Custom CSS with robust CSS variables for a consistent "glass" theme.

## 🛠️ How to Run Locally

1. Clone the repository.
2. Install dependencies: `npm install`
3. Create a `.env.local` file in the root directory and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=AIzaSyYourAPIKeyHere...
   ```
4. Start the development server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000) in your browser.
