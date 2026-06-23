import { useEffect, useState, useRef } from 'react';
import { subscribeCustomWords } from '../services/customWordsService';

/**
 * Hook to subscribe to global custom words
 * Returns the list of custom words added by any player
 */
export function useCustomWordsSubscription(): string[] {
  const [customWords, setCustomWords] = useState<string[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Avoid re-subscribing on every render by using useRef
    if (!unsubscribeRef.current) {
      unsubscribeRef.current = subscribeCustomWords((words) => {
        setCustomWords(words);
      });
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []); // Empty deps — subscribe once on mount

  return customWords;
}
