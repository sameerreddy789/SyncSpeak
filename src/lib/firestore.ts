import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import { ScriptAnalysis } from '@/types';

// =============================================================================
// SyncSpeak — Firestore Integration
// =============================================================================
//
// All three functions translate raw Firebase errors into plain, user-facing
// messages (mirrors the friendly-error pattern in ai.ts). The UI can display
// the thrown message directly instead of leaking codes like
// "permission-denied".
// =============================================================================

// Maximum number of scripts fetched per load. Caps per-page Firestore reads
// so a user with hundreds of saved scripts doesn't trigger a huge query on
// every dashboard visit (see SYSTEM_DESIGN.md §8 — keep per-op work bounded).
const MAX_SCRIPTS_TO_LOAD = 50;

/** Map a Firebase error code/message into a friendly, display-ready string. */
function friendlyFirestoreError(error: unknown, fallback: string): Error {
  const code =
    (error as { code?: string })?.code ?? '';
  const msg =
    ((error as { message?: string })?.message ?? '').toLowerCase();

  let message: string;

  if (code === 'permission-denied' || msg.includes('permission-denied')) {
    message = "You don't have access to this data. Try signing in again.";
  } else if (code === 'unavailable' || msg.includes('unavailable')) {
    message = 'The database is temporarily unavailable. Please try again.';
  } else if (code === 'not-found' || msg.includes('not-found') || msg.includes('no document')) {
    message = 'This script no longer exists.';
  } else {
    message = fallback;
  }

  return new Error(message);
}

export async function saveScript(userId: string, script: ScriptAnalysis): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const scriptRef = doc(db, 'users', userId, 'scripts', script.id);
  // Ensure we don't pass undefined values which Firestore rejects
  const safeScript = JSON.parse(JSON.stringify(script));
  try {
    await setDoc(scriptRef, safeScript);
  } catch (error) {
    throw friendlyFirestoreError(error, 'Could not save your script. Please try again.');
  }
}

export async function loadScripts(userId: string): Promise<ScriptAnalysis[]> {
  if (!db) throw new Error('Firestore not initialized');

  try {
    const scriptsRef = collection(db, 'users', userId, 'scripts');
    // Order by createdAt descending, capped at MAX_SCRIPTS_TO_LOAD to bound the
    // read cost per dashboard load.
    const q = query(scriptsRef, orderBy('createdAt', 'desc'), limit(MAX_SCRIPTS_TO_LOAD));
    const snapshot = await getDocs(q);

    const scripts: ScriptAnalysis[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as ScriptAnalysis;
      // Firestore stores dates as Timestamps, we might need to convert them if they were parsed back
      if (data.createdAt && typeof (data.createdAt as any).toDate === 'function') {
        data.createdAt = (data.createdAt as any).toDate();
      } else if (typeof data.createdAt === 'string') {
        data.createdAt = new Date(data.createdAt);
      }
      scripts.push(data);
    });

    return scripts;
  } catch (error) {
    throw friendlyFirestoreError(error, 'Could not load your saved scripts. Please try again.');
  }
}

export async function deleteScript(userId: string, scriptId: string): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const scriptRef = doc(db, 'users', userId, 'scripts', scriptId);
  try {
    await deleteDoc(scriptRef);
  } catch (error) {
    throw friendlyFirestoreError(error, 'Could not delete the script. Please try again.');
  }
}
