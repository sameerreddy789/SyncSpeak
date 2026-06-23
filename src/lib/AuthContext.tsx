'use client';

// =============================================================================
// SyncSpeak — Firebase Auth context
// =============================================================================
//
// Exposes the signed-in user plus a friendly `authError` string and an
// `isAuthenticated` helper so components don't re-derive "configured AND
// signed in" ad-hoc. Raw Firebase error codes (e.g. "auth/popup-closed-by-user")
// are translated into human-readable messages before reaching the UI — same
// friendly-error pattern used in lib/ai.ts and lib/firestore.ts.
// =============================================================================

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** Friendly, display-ready error from the last sign-in attempt (or null). */
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  isConfigured: boolean;
  /** True only when Firebase is configured AND a user is signed in. */
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  authError: null,
  signInWithGoogle: async () => { console.warn('Firebase not configured'); },
  signOut: async () => { console.warn('Firebase not configured'); },
  isConfigured: false,
  isAuthenticated: false,
});

/** Translate a Firebase Auth error code into a user-facing message. */
function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    case 'auth/cancelled-popup-request':
      // User clicked sign-in again while a popup was already open — not an
      // error worth surfacing; return empty so the caller can ignore it.
      return '';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled for this project.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for sign-in.';
    default:
      return 'Could not sign in. Please try again.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!auth) throw new Error('Firebase Auth not initialized');
    setAuthError(null); // reset on each attempt
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      const friendly = friendlyAuthError(error);
      // cancelled-popup-request is benign — ignore silently rather than flag it.
      if (friendly) {
        setAuthError(friendly);
      }
      console.error('Error signing in with Google', error);
      throw new Error(friendly || 'Sign-in cancelled.');
    }
  };

  const signOut = async () => {
    if (!auth) throw new Error('Firebase Auth not initialized');
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out', error);
      throw new Error('Could not sign out. Please try again.');
    }
  };

  // Centralised check so components don't drift between "user && isConfigured".
  const isAuthenticated = isFirebaseConfigured && !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        signInWithGoogle,
        signOut,
        isConfigured: isFirebaseConfigured,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
