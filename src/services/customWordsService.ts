import { ref, get, set, onValue, off } from 'firebase/database';
import { db } from './firebase';

const CUSTOM_WORDS_PATH = 'globalCustomWords';

/**
 * Add a word to the global custom words pool (idempotent — uses word as key)
 */
export async function addCustomWord(word: string): Promise<void> {
  const normalizedWord = word.toLowerCase().trim();
  if (!normalizedWord) throw new Error('Word cannot be empty');
  
  const wordRef = ref(db, `${CUSTOM_WORDS_PATH}/${normalizedWord}`);
  await set(wordRef, { word: normalizedWord });
}

/**
 * Fetch all global custom words (one-time read)
 */
export async function getCustomWords(): Promise<string[]> {
  const wordsRef = ref(db, CUSTOM_WORDS_PATH);
  const snapshot = await get(wordsRef);
  if (!snapshot.exists()) return [];
  
  const data = snapshot.val() as Record<string, { word: string }> | null;
  if (!data) return [];
  
  return Object.values(data).map((obj) => obj.word);
}

/**
 * Subscribe to all global custom words (real-time listener)
 */
export function subscribeCustomWords(callback: (words: string[]) => void): (() => void) {
  const wordsRef = ref(db, CUSTOM_WORDS_PATH);
  
  const unsubscribe = onValue(
    wordsRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }
      
      const data = snapshot.val() as Record<string, { word: string }> | null;
      if (!data) {
        callback([]);
        return;
      }
      
      const words = Object.values(data).map((obj) => obj.word);
      callback(words);
    },
    (error) => {
      console.error('Error subscribing to custom words:', error);
      callback([]);
    }
  );
  
  return () => {
    off(wordsRef);
    unsubscribe();
  };
}
