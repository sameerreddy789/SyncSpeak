import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { ScriptAnalysis } from '@/types';

// =============================================================================
// SyncSpeak — Firestore Integration
// =============================================================================

export async function saveScript(userId: string, script: ScriptAnalysis): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');
  
  const scriptRef = doc(db, 'users', userId, 'scripts', script.id);
  // Ensure we don't pass undefined values which Firestore rejects
  const safeScript = JSON.parse(JSON.stringify(script));
  await setDoc(scriptRef, safeScript);
}

export async function loadScripts(userId: string): Promise<ScriptAnalysis[]> {
  if (!db) throw new Error('Firestore not initialized');

  const scriptsRef = collection(db, 'users', userId, 'scripts');
  // Order by createdAt descending
  const q = query(scriptsRef, orderBy('createdAt', 'desc'));
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
}

export async function deleteScript(userId: string, scriptId: string): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');
  
  const scriptRef = doc(db, 'users', userId, 'scripts', scriptId);
  await deleteDoc(scriptRef);
}
