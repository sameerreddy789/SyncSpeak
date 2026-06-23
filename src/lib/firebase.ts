// =============================================================================
// Firebase client configuration
// =============================================================================
//
// SECURITY NOTE — these `NEXT_PUBLIC_FIREBASE_*` values are PUBLIC BY DESIGN.
// Anything prefixed with NEXT_PUBLIC_ is embedded in the client bundle, so it
// ships to every visitor's browser. That is fine here because these values
// only *identify* the Firebase project — they do not *authorise* access to
// data. (See docs/BACKEND_PRINCIPLES.md §4.1 "Security": Firebase web config
// keys are safe to expose; security is enforced elsewhere.)
//
// **Real data security depends on Firestore Security Rules**, configured in the
// Firebase Console (not in this repo). Without rules, your database is in test
// mode and anyone with these (public) keys can read/write it.
//
// Apply this starter rule in the Firebase Console → Firestore → Rules so each
// signed-in user can only touch their own subcollection:
//
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /users/{userId}/{document=**} {
//         allow read, write: if request.auth != null && request.auth.uid == userId;
//       }
//     }
//   }
//
// Contrast with OPENROUTER_API_KEY, which is a real secret and must NEVER
// carry the NEXT_PUBLIC_ prefix — it lives only on the server (see lib/ai.ts).
// =============================================================================

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase only if we have a config and it hasn't been initialized yet
const app = getApps().length > 0 
  ? getApp() 
  : (firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null);

export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;

export const isFirebaseConfigured = !!app;
