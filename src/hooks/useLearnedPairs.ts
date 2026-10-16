import { useEffect, useState } from 'react';
import { subscribeLearnedPairs } from '../services/pairVotesService';

/**
 * Pair keys (see pairKey) that enough players voted to connect.
 * These are always auto-bridged, whatever the similarity score says.
 */
export function useLearnedPairs(): Set<string> {
  const [learned, setLearned] = useState<Set<string>>(() => new Set());

  useEffect(() => subscribeLearnedPairs(setLearned), []);

  return learned;
}
