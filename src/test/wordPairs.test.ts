import { describe, it, expect } from 'vitest';
import { pickWordPair, WORD_PAIRS } from '../utils/wordPairs';

const key = ([a, b]: [string, string]) => `${a}/${b}`;

describe('WORD_PAIRS data', () => {
  it('has enough variety', () => {
    expect(WORD_PAIRS.length).toBeGreaterThanOrEqual(400);
  });

  it('has no duplicate pairs in either order and no self-pairs', () => {
    const seen = new Set<string>();
    for (const [a, b] of WORD_PAIRS) {
      expect(a).not.toBe(b);
      const k = [a, b].sort().join('/');
      expect(seen.has(k), `duplicate pair ${k}`).toBe(false);
      seen.add(k);
    }
  });

  it('uses only lowercase single words', () => {
    for (const w of WORD_PAIRS.flat()) expect(w).toMatch(/^[a-z]+$/);
  });
});

describe('pickWordPair', () => {
  it('never reuses a word from the last 10 rounds while fresh pairs remain', () => {
    const history: string[] = [];
    for (let round = 0; round < 60; round++) {
      const pair = pickWordPair(history);
      const recent = new Set(history.slice(-10).flatMap((p) => p.split('/')));
      expect(recent.has(pair[0]) || recent.has(pair[1]), `round ${round}: ${key(pair)}`).toBe(false);
      history.push(key(pair));
    }
  });

  it('only returns curated pairs', () => {
    const curated = new Set(WORD_PAIRS.map(key));
    for (let i = 0; i < 50; i++) expect(curated.has(key(pickWordPair()))).toBe(true);
  });

  it('falls back to any pair once every pair has been used', () => {
    const all = WORD_PAIRS.map(key);
    expect(all).toContain(key(pickWordPair(all)));
  });
});
