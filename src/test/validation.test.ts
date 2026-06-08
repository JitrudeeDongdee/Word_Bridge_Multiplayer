import { describe, it, expect } from 'vitest';
import { validateWord } from '../utils/validation';
import type { GameNode } from '../types';

const node = (word: string): GameNode => ({
  id: 'x',
  word,
  x: 0,
  y: 0,
  createdBy: 'test',
  isStart: false,
});

describe('validateWord', () => {
  it('accepts a valid word', () => {
    expect(validateWord('bridge', [])).toEqual({ valid: true });
  });

  it('rejects empty string', () => {
    const r = validateWord('', []);
    expect(r.valid).toBe(false);
  });

  it('rejects words with numbers', () => {
    const r = validateWord('word123', []);
    expect(r.valid).toBe(false);
  });

  it('rejects single character words', () => {
    const r = validateWord('a', []);
    expect(r.valid).toBe(false);
  });

  it('rejects words longer than 30 chars', () => {
    const r = validateWord('a'.repeat(31), []);
    expect(r.valid).toBe(false);
  });

  it('rejects duplicate words (case insensitive)', () => {
    const r = validateWord('Bridge', [node('bridge')]);
    expect(r.valid).toBe(false);
  });

  it('rejects when max nodes reached', () => {
    const nodes = Array.from({ length: 50 }, (_, i) => node(`word${i}`));
    const r = validateWord('newword', nodes);
    expect(r.valid).toBe(false);
  });
});
