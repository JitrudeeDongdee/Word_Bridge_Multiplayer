import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub fetch globally before any module import so the module-level cache starts empty
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Re-import the module fresh each test so the module-level cache is always empty
async function importFresh() {
  vi.resetModules();
  const mod = await import('../utils/semanticSimilarity');
  return mod.semanticSimilarity;
}

const datamuse = (words: Array<{ word: string; score: number }>) =>
  Promise.resolve(new Response(JSON.stringify(words), { status: 200 }));

const empty = () => datamuse([]);
const httpError = () => Promise.resolve(new Response('', { status: 500 }));
const networkError = () => Promise.reject(new Error('network failure'));
const conceptNet = (value: number) =>
  Promise.resolve(new Response(JSON.stringify({ value }), { status: 200 }));
const conceptNetError = () => Promise.resolve(new Response('', { status: 502 }));

describe('semanticSimilarity', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns 1.0 when word B is the top ml result for word A', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('ml=cat')) return datamuse([{ word: 'kitten', score: 500 }]);
      if (url.includes('conceptnet')) return conceptNetError();
      return empty();
    });
    expect(await semanticSimilarity('cat', 'kitten')).toBeCloseTo(1.0);
  });

  it('returns normalised score when word is not the top result', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('ml=hot'))
        return datamuse([
          { word: 'warm', score: 1000 },
          { word: 'cold', score: 400 },
        ]);
      if (url.includes('conceptnet')) return conceptNetError();
      return empty();
    });
    expect(await semanticSimilarity('hot', 'cold')).toBeCloseTo(0.4);
  });

  it('checks bidirectionally — uses ml(B)[A] when ml(A)[B] is 0', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('ml=ocean')) return datamuse([{ word: 'sea', score: 100 }]);
      if (url.includes('ml=river')) return datamuse([{ word: 'ocean', score: 200 }]);
      if (url.includes('conceptnet')) return conceptNetError();
      return empty();
    });
    // ml(ocean)[river] = 0, but ml(river)[ocean] = 1.0
    expect(await semanticSimilarity('ocean', 'river')).toBeCloseTo(1.0);
  });

  it('uses rel_trg score when higher than ml', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('ml=bread'))
        return datamuse([{ word: 'butter', score: 100 }, { word: 'cake', score: 20 }]);
      if (url.includes('rel_trg=bread')) return datamuse([{ word: 'cake', score: 100 }]);
      if (url.includes('conceptnet')) return conceptNetError();
      return empty();
    });
    // ml(bread)[cake] = 0.2, rel_trg(bread)[cake] = 1.0 → max = 1.0
    expect(await semanticSimilarity('bread', 'cake')).toBeCloseTo(1.0);
  });

  it('applies 0.8 weight to ConceptNet score', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('conceptnet')) return conceptNet(0.5);
      return empty();
    });
    // 0.5 * 0.8 = 0.4
    expect(await semanticSimilarity('war', 'dead')).toBeCloseTo(0.4);
  });

  it('uses ConceptNet score when it exceeds Datamuse', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('ml=fire'))
        return datamuse([{ word: 'smoke', score: 1000 }, { word: 'ice', score: 100 }]);
      if (url.includes('conceptnet')) return conceptNet(0.9);
      return empty();
    });
    // ml(fire)[ice] = 0.1, conceptnet = 0.9 * 0.8 = 0.72 → max = 0.72
    expect(await semanticSimilarity('fire', 'ice')).toBeCloseTo(0.72);
  });

  it('clamps negative ConceptNet values to 0', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('conceptnet')) return conceptNet(-0.3);
      return empty();
    });
    expect(await semanticSimilarity('apple', 'rock')).toBe(0);
  });

  it('returns 0 on Datamuse HTTP error without throwing', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('conceptnet')) return conceptNetError();
      return httpError();
    });
    await expect(semanticSimilarity('sun', 'moon')).resolves.toBe(0);
  });

  it('returns 0 on network error without throwing', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation(() => networkError());
    await expect(semanticSimilarity('fire', 'water')).resolves.toBe(0);
  });

  it('returns 0 when no relation exists on any source', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('conceptnet')) return conceptNet(0);
      return empty();
    });
    expect(await semanticSimilarity('table', 'justice')).toBe(0);
  });
});
