import { ref, get, set, update, onValue } from 'firebase/database';
import { db } from './firebase';
import { track } from './analytics';

const VOTES_PATH = 'pairVotes';
const LEARNED_PATH = 'learnedPairs';

/** Distinct voters (by IP, or player ID when the IP is unknown) needed before a pair is learned. */
export const PAIR_VOTE_THRESHOLD = 3;

interface PairVoteRecord {
  a: string;
  b: string;
  voters?: Record<string, { playerId: string; at: number }>;
}

export interface PairVoteResult {
  count: number;
  learned: boolean;
}

/** Order-independent key for a word pair, e.g. ("Sun", "moon") → "moon|sun". */
export function pairKey(a: string, b: string): string {
  const [x, y] = [a.toLowerCase().trim(), b.toLowerCase().trim()].sort();
  return `${x}|${y}`;
}

/**
 * One vote per network: voters are keyed by public IP so a single person can't
 * reach the threshold by opening more tabs. Falls back to player ID when the IP
 * lookup failed. Firebase keys can't contain . # $ [ ] / so those become _.
 */
export function voterKey(playerId: string, ip?: string): string {
  return (ip ? `ip_${ip}` : `p_${playerId}`).replace(/[.#$[\]/:]/g, '_');
}

function countVoters(record: PairVoteRecord | null): number {
  return Object.keys(record?.voters ?? {}).length;
}

/** Current number of distinct voters for a pair. */
export async function getPairVoteCount(a: string, b: string): Promise<number> {
  const snapshot = await get(ref(db, `${VOTES_PATH}/${pairKey(a, b)}`));
  return countVoters(snapshot.val() as PairVoteRecord | null);
}

/**
 * Records a vote that two words should be connected (idempotent per voter).
 * Once the pair reaches PAIR_VOTE_THRESHOLD it is added to the learned-pairs index.
 */
export async function castPairVote(
  a: string,
  b: string,
  playerId: string,
  ip?: string,
): Promise<PairVoteResult> {
  const key = pairKey(a, b);
  const [x, y] = key.split('|');

  await update(ref(db, `${VOTES_PATH}/${key}`), {
    a: x,
    b: y,
    [`voters/${voterKey(playerId, ip)}`]: { playerId, at: Date.now() },
  });

  const count = await getPairVoteCount(x, y);
  const learned = count >= PAIR_VOTE_THRESHOLD;
  if (learned) await set(ref(db, `${LEARNED_PATH}/${key}`), true);
  track('vote_link', { learned });
  return { count, learned };
}

/** Subscribes to the set of learned pair keys (real-time). */
export function subscribeLearnedPairs(callback: (keys: Set<string>) => void): () => void {
  return onValue(
    ref(db, LEARNED_PATH),
    (snapshot) => {
      const data = snapshot.val() as Record<string, true> | null;
      callback(new Set(Object.keys(data ?? {})));
    },
    (error) => {
      console.error('Error subscribing to learned pairs:', error);
      callback(new Set());
    },
  );
}
