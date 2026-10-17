import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateWord, checkRealWord } from '../utils/validation';
import { resetDictionaryState, lookupDefinition } from '../services/dictionary';
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

describe('checkRealWord', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    resetDictionaryState(); // lookups are cached per word across calls
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const json = (body: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
    );
  const html = (status: number) =>
    Promise.resolve(new Response('<html>error</html>', { status, headers: { 'content-type': 'text/html' } }));
  const datamuse = (items: unknown[]) => json(items);

  const route = (dict: () => Promise<Response>, dm: () => Promise<Response>) =>
    mockFetch.mockImplementation((url: string) => (url.includes('dictionaryapi') ? dict() : dm()));

  it('accepts a word as soon as either source knows it', async () => {
    route(() => json([{ word: 'water' }]), () => datamuse([]));
    expect(await checkRealWord('water')).toBe('valid');
  });

  it('asks both sources in parallel instead of waiting for one to time out', async () => {
    route(() => new Promise(() => {}), () => datamuse([{ word: 'egg', tags: ['n'], defs: ['n\tan egg'] }]));
    expect(await checkRealWord('egg')).toBe('valid'); // resolves without waiting on dictionaryapi
    expect(mockFetch.mock.calls.map(([u]) => (u as string).includes('dictionaryapi'))).toEqual([true, false]);
  });

  it('checks each word only once', async () => {
    route(() => json([{ word: 'water' }]), () => datamuse([]));
    await checkRealWord('water');
    await checkRealWord('Water');
    expect(mockFetch).toHaveBeenCalledTimes(2); // one call per source, then cached
  });

  it('skips a source that keeps failing', async () => {
    route(() => Promise.reject(new TypeError('down')), () => datamuse([{ word: 'a', tags: ['n'], defs: ['n\tx'] }]));
    for (const w of ['a', 'b', 'c']) await checkRealWord(w);
    const dictCalls = mockFetch.mock.calls.filter(([u]) => (u as string).includes('dictionaryapi')).length;
    expect(dictCalls).toBe(2); // skipped after 2 failures in a row
  });

  it('reports not found when both sources answer without the word', async () => {
    route(() => json({ title: 'No Definitions Found' }, 404), () => datamuse([]));
    expect(await checkRealWord('qwzx')).toBe('not_found');
  });

  it('falls back to Datamuse when dictionaryapi.dev serves an HTML error page', async () => {
    route(() => html(404), () => datamuse([{ word: 'egg', tags: ['n', 'v'], defs: ['n\tan egg'] }]));
    expect(await checkRealWord('egg')).toBe('valid');
  });

  it('falls back to Datamuse when dictionaryapi.dev is unreachable', async () => {
    route(() => Promise.reject(new TypeError('Failed to fetch')),
      () => datamuse([{ word: 'cat', tags: ['n'], defs: ['n\ta cat'] }]));
    expect(await checkRealWord('Cat')).toBe('valid');
  });

  it('rejects proper nouns from the fallback', async () => {
    route(() => html(503), () => datamuse([{ word: 'london', tags: ['n', 'prop'], defs: ['n\ta city'] }]));
    expect(await checkRealWord('london')).toBe('not_found');
  });

  it('rejects fallback matches that are a different spelling or have no definition', async () => {
    route(() => html(503), () => datamuse([{ word: 'waters', tags: ['n'], defs: ['n\tx'] }]));
    expect(await checkRealWord('watr')).toBe('not_found');
    route(() => html(503), () => datamuse([{ word: 'blorp', tags: ['n'] }]));
    expect(await checkRealWord('blorp')).toBe('not_found');
  });

  it('reports a network error only when both sources are down', async () => {
    route(() => Promise.reject(new TypeError('x')), () => Promise.reject(new TypeError('y')));
    expect(await checkRealWord('egg')).toBe('network_error');
  });

  it('gives up on a hanging dictionaryapi.dev after the timeout', async () => {
    vi.useFakeTimers();
    route(
      () => new Promise((_, reject) => {
        const [, init] = mockFetch.mock.calls.at(-1) as [string, RequestInit];
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
      () => datamuse([{ word: 'egg', tags: ['n'], defs: ['n\tan egg'] }]),
    );
    const pending = checkRealWord('egg');
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toBe('valid');
    vi.useRealTimers();
  });
});

describe('lookupDefinition', () => {
  const mockFetch = vi.fn();
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    resetDictionaryState();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('falls back to a Datamuse definition when dictionaryapi.dev is down', async () => {
    mockFetch.mockImplementation((url: string) =>
      url.includes('dictionaryapi')
        ? Promise.reject(new TypeError('down'))
        : Promise.resolve(new Response(JSON.stringify([{ word: 'lantern', tags: ['n'], defs: ['n\tA case for a light'] }]))),
    );
    expect(await lookupDefinition('lantern')).toEqual({ definition: 'A case for a light', partOfSpeech: 'noun' });
  });

  it('returns null when no source knows the word', async () => {
    mockFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify([]))));
    expect(await lookupDefinition('qwzx')).toBeNull();
  });
});
