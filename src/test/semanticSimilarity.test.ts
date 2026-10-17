import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub fetch globally before any module import so the module-level cache starts empty
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// The real embedding model downloads ~23MB and runs ONNX; tests control its output directly
const mockEmbedding = vi.fn<(a: string, b: string) => Promise<number | null>>();
vi.mock('../utils/embeddingSimilarity', () => ({
  embeddingSimilarity: (a: string, b: string) => mockEmbedding(a, b),
}));

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

describe('semanticSimilarity', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockEmbedding.mockReset();
    mockEmbedding.mockResolvedValue(null); // model unavailable unless a test says otherwise
  });

  it('returns 1.0 when word B is the top ml result for word A', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('ml=cat')) return datamuse([{ word: 'kitten', score: 500 }]);
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
      return empty();
    });
    expect(await semanticSimilarity('hot', 'cold')).toBeCloseTo(0.4);
  });

  it('checks bidirectionally — uses ml(B)[A] when ml(A)[B] is 0', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('ml=ocean')) return datamuse([{ word: 'sea', score: 100 }]);
      if (url.includes('ml=river')) return datamuse([{ word: 'ocean', score: 200 }]);
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
      return empty();
    });
    // ml(bread)[cake] = 0.2, rel_trg(bread)[cake] = 1.0 → max = 1.0
    expect(await semanticSimilarity('bread', 'cake')).toBeCloseTo(1.0);
  });

  it('uses the embedding score when Datamuse has no relation', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation(() => empty());
    mockEmbedding.mockResolvedValue(0.476); // sun–summer, measured
    const sim = await semanticSimilarity('sun', 'summer');
    expect(sim).toBeGreaterThanOrEqual(0.15);
  });

  it('keeps the Datamuse score when it beats the embedding score', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('ml=fire')) return datamuse([{ word: 'smoke', score: 1000 }]);
      return empty();
    });
    mockEmbedding.mockResolvedValue(0.4);
    expect(await semanticSimilarity('fire', 'smoke')).toBeCloseTo(1.0);
  });

  it('does not link common nouns the model scores in its noise band (0.35–0.45)', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation(() => empty());
    for (const cos of [0.392, 0.418]) {
      // dog–king and puppet–dog, measured: neither is related, Datamuse knows neither
      mockEmbedding.mockResolvedValueOnce(cos);
      expect(await semanticSimilarity('dog', `king${cos}`)).toBeLessThan(0.15);
    }
  });

  it('stays below the bridge threshold for unrelated embedding scores', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation(() => empty());
    mockEmbedding.mockResolvedValue(0.342); // bottle–elephant, highest unrelated pair measured
    expect(await semanticSimilarity('bottle', 'elephant')).toBeLessThan(0.15);
  });

  it('returns 0 on Datamuse HTTP error without throwing', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation(() => httpError());
    await expect(semanticSimilarity('sun', 'moon')).resolves.toBe(0);
  });

  it('returns 0 on network error without throwing', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation(() => networkError());
    await expect(semanticSimilarity('fire', 'water')).resolves.toBe(0);
  });

  it('returns 0 when no relation exists on any source', async () => {
    const semanticSimilarity = await importFresh();
    mockFetch.mockImplementation(() => empty());
    mockEmbedding.mockResolvedValue(-0.1);
    expect(await semanticSimilarity('table', 'justice')).toBe(0);
  });
});

describe('normalizeCosine', () => {
  it('maps the related-cosine cutoff exactly onto the bridge threshold', async () => {
    const { normalizeCosine, EMBEDDING_RELATED_COSINE, AUTO_BRIDGE_THRESHOLD } = await import(
      '../utils/semanticSimilarity'
    );
    expect(normalizeCosine(EMBEDDING_RELATED_COSINE)).toBeCloseTo(AUTO_BRIDGE_THRESHOLD);
  });

  it('maps 1 to 1 and non-positive values to 0', async () => {
    const { normalizeCosine } = await import('../utils/semanticSimilarity');
    expect(normalizeCosine(1)).toBeCloseTo(1);
    expect(normalizeCosine(0)).toBe(0);
    expect(normalizeCosine(-0.5)).toBe(0);
  });

  it('is monotonic increasing', async () => {
    const { normalizeCosine } = await import('../utils/semanticSimilarity');
    const values = [0.1, 0.2, 0.34, 0.35, 0.36, 0.5, 0.8].map(normalizeCosine);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
  });
});
