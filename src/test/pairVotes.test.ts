import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory stand-in for the Realtime Database paths the service touches
const store: Record<string, unknown> = {};
const mockSet = vi.fn();

vi.mock('../services/firebase', () => ({ db: {} }));
vi.mock('firebase/database', () => ({
  ref: (_db: unknown, path: string) => path,
  get: async (path: string) => ({ val: () => store[path] ?? null }),
  set: async (path: string, value: unknown) => {
    mockSet(path, value);
    store[path] = value;
  },
  update: async (path: string, values: Record<string, unknown>) => {
    const rec = (store[path] ?? {}) as Record<string, unknown> & { voters?: Record<string, unknown> };
    for (const [k, v] of Object.entries(values)) {
      if (k.startsWith('voters/')) rec.voters = { ...rec.voters, [k.slice(7)]: v };
      else rec[k] = v;
    }
    store[path] = rec;
  },
  onValue: vi.fn(),
}));

import {
  pairKey,
  voterKey,
  castPairVote,
  getPairVoteCount,
  PAIR_VOTE_THRESHOLD,
} from '../services/pairVotesService';

describe('pairKey', () => {
  it('is order- and case-independent', () => {
    expect(pairKey('Sun', 'moon')).toBe('moon|sun');
    expect(pairKey('moon', 'SUN')).toBe('moon|sun');
  });
});

describe('voterKey', () => {
  it('uses the IP when known, with Firebase-illegal characters replaced', () => {
    expect(voterKey('p1', '203.0.113.7')).toBe('ip_203_0_113_7');
    expect(voterKey('p1', '2001:db8::1')).toBe('ip_2001_db8__1');
  });

  it('falls back to the player ID without an IP', () => {
    expect(voterKey('abc-123')).toBe('p_abc-123');
  });
});

describe('castPairVote', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    mockSet.mockReset();
  });

  it('counts each network once, however many times it votes', async () => {
    await castPairVote('sun', 'summer', 'p1', '1.1.1.1');
    await castPairVote('summer', 'sun', 'p2', '1.1.1.1'); // other tab, same network
    const res = await castPairVote('sun', 'summer', 'p1', '1.1.1.1');
    expect(res).toEqual({ count: 1, learned: false });
    expect(await getPairVoteCount('summer', 'sun')).toBe(1);
  });

  it(`learns the pair at ${PAIR_VOTE_THRESHOLD} distinct voters`, async () => {
    const ips = ['1.1.1.1', '2.2.2.2', '3.3.3.3'];
    const results = [];
    for (const [i, ip] of ips.entries()) results.push(await castPairVote('war', 'dead', `p${i}`, ip));

    expect(results.map((r) => r.learned)).toEqual([false, false, true]);
    expect(mockSet).toHaveBeenCalledWith('learnedPairs/dead|war', true);
  });

  it('does not write to learnedPairs below the threshold', async () => {
    await castPairVote('coffee', 'morning', 'p1', '1.1.1.1');
    await castPairVote('coffee', 'morning', 'p2', '2.2.2.2');
    expect(mockSet).not.toHaveBeenCalled();
  });
});
