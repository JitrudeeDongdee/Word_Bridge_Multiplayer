const TIMEOUT_MS = 3000;

interface DatuseItem {
  word: string;
  score: number;
}

interface ConceptNetRelatednessResponse {
  value: number;
}

// Module-level cache: "<rel>:<word>" → Map<relatedWord, normalizedScore>
const relatedCache = new Map<string, Map<string, number>>();

// Module-level cache: "word1|word2" → relatedness score
const conceptNetCache = new Map<string, number>();

// Circuit breaker: stop calling ConceptNet after 3 consecutive failures
let cnFailCount = 0;
const CN_FAIL_LIMIT = 3;

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
      return new Map();
    }

    const data = (await res.json()) as DatuseItem[];
    const maxScore = data[0]?.score ?? 1;
    const scores = new Map<string, number>(
      data.map((item) => [item.word.toLowerCase(), item.score / maxScore]),
    );
    relatedCache.set(key, scores);
    return scores;
  } catch {
    clearTimeout(timer);
    return new Map();
  }
}

async function fetchConceptNetRelatedness(a: string, b: string): Promise<number> {
  if (cnFailCount >= CN_FAIL_LIMIT) return 0;

  const cacheKey = a < b ? `${a}|${b}` : `${b}|${a}`;
  if (conceptNetCache.has(cacheKey)) return conceptNetCache.get(cacheKey)!;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `https://api.conceptnet.io/relatedness?node1=/c/en/${encodeURIComponent(a)}&node2=/c/en/${encodeURIComponent(b)}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      cnFailCount++;
      return 0;
    }

    cnFailCount = 0; // reset on success
    const data = (await res.json()) as ConceptNetRelatednessResponse;
    const score = Math.max(0, data.value ?? 0);
    conceptNetCache.set(cacheKey, score);
    return score;
  } catch {
    clearTimeout(timer);
    cnFailCount++;
    return 0;
  }
}

/**
 * Returns semantic relatedness [0, 1] between two English words.
 * Combines Datamuse API (means-like + triggers) with ConceptNet relatedness
 * for broader conceptual coverage (e.g. "war" ↔ "dead").
 * Results are cached in memory so each pair is only fetched once per session.
 */
export async function semanticSimilarity(a: string, b: string): Promise<number> {
  const wa = a.toLowerCase();
  const wb = b.toLowerCase();

  const [mlA, trgA, mlB, trgB, cnScore] = await Promise.all([
    fetchRelatedScores(wa, 'ml'),
    fetchRelatedScores(wa, 'rel_trg'),
    fetchRelatedScores(wb, 'ml'),
    fetchRelatedScores(wb, 'rel_trg'),
    fetchConceptNetRelatedness(wa, wb),
  ]);

  const datuseScore = Math.max(
    mlA.get(wb) ?? 0,
    trgA.get(wb) ?? 0,
    mlB.get(wa) ?? 0,
    trgB.get(wa) ?? 0,
  );

  // Weight ConceptNet at 0.8 so it can connect conceptually related pairs
  // without making the threshold trivially easy to hit
  return Math.max(datuseScore, cnScore * 0.8);
}

