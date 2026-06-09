const TIMEOUT_MS = 5000;

interface DatuseItem {
  word: string;
  score: number;
}

// Module-level cache: "<rel>:<word>" → Map<relatedWord, normalizedScore>
const relatedCache = new Map<string, Map<string, number>>();

async function fetchRelatedScores(
  word: string,
  rel: 'ml' | 'rel_trg',
): Promise<Map<string, number>> {
  const key = `${rel}:${word}`;
  if (relatedCache.has(key)) return relatedCache.get(key)!;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `https://api.datamuse.com/words?${rel}=${encodeURIComponent(word)}&max=200`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      // Don't cache HTTP errors — allow a retry on the next call
      return new Map();
    }

    const data = (await res.json()) as DatuseItem[];
    const maxScore = data[0]?.score ?? 1;
    const scores = new Map<string, number>(
      data.map((item) => [item.word.toLowerCase(), item.score / maxScore]),
    );
    // Cache successful results (including genuine empty-200 responses)
    relatedCache.set(key, scores);
    return scores;
  } catch {
    clearTimeout(timer);
    // Don't cache timeouts / network errors — allow a retry on the next call
    return new Map();
  }
}

/**
 * Returns semantic relatedness [0, 1] between two English words
 * using the Datamuse API (bidirectional "means-like" + "triggers").
 * Results are cached in memory so each word is only fetched once per session.
 */
export async function semanticSimilarity(a: string, b: string): Promise<number> {
  const wa = a.toLowerCase();
  const wb = b.toLowerCase();

  const [mlA, trgA, mlB, trgB] = await Promise.all([
    fetchRelatedScores(wa, 'ml'),
    fetchRelatedScores(wa, 'rel_trg'),
    fetchRelatedScores(wb, 'ml'),
    fetchRelatedScores(wb, 'rel_trg'),
  ]);

  return Math.max(
    mlA.get(wb) ?? 0,
    trgA.get(wb) ?? 0,
    mlB.get(wa) ?? 0,
    trgB.get(wa) ?? 0,
  );
}

