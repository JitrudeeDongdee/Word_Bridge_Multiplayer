import { embeddingSimilarity } from './embeddingSimilarity';

const TIMEOUT_MS = 3000;

/** Score (on the [0, 1] scale returned by semanticSimilarity) at which two words get auto-bridged. */
export const AUTO_BRIDGE_THRESHOLD = 0.15;

// Cosine similarity at which two words count as related. Calibrated in-browser
// on 2026-10-17 with all-MiniLM-L6-v2: 25 related pairs scored 0.357–0.803
// (coffee–morning 0.357, war–dead 0.384, sun–summer 0.476), 20 unrelated pairs
// scored 0.123–0.342 (bottle–elephant 0.342).
export const EMBEDDING_RELATED_COSINE = 0.35;

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

/**
 * Maps cosine similarity onto the same [0, 1] scale as the Datamuse score,
 * piecewise-linearly, so EMBEDDING_RELATED_COSINE lands exactly on
 * AUTO_BRIDGE_THRESHOLD and 1.0 stays 1.0.
 */
export function normalizeCosine(cos: number): number {
  if (cos <= 0) return 0;
  if (cos < EMBEDDING_RELATED_COSINE) {
    return (cos / EMBEDDING_RELATED_COSINE) * AUTO_BRIDGE_THRESHOLD;
  }
  const t = (cos - EMBEDDING_RELATED_COSINE) / (1 - EMBEDDING_RELATED_COSINE);
  return Math.min(1, AUTO_BRIDGE_THRESHOLD + t * (1 - AUTO_BRIDGE_THRESHOLD));
}

/**
 * Returns semantic relatedness [0, 1] between two English words.
 * Combines an in-browser embedding model (a continuous score for any pair)
 * with Datamuse API (means-like + triggers), taking whichever is higher.
 * If the model fails to load, Datamuse alone is used.
 * Results are cached in memory so each pair is only fetched once per session.
 */
export async function semanticSimilarity(a: string, b: string): Promise<number> {
  const wa = a.toLowerCase();
  const wb = b.toLowerCase();

  const [mlA, trgA, mlB, trgB, cos] = await Promise.all([
    fetchRelatedScores(wa, 'ml'),
    fetchRelatedScores(wa, 'rel_trg'),
    fetchRelatedScores(wb, 'ml'),
    fetchRelatedScores(wb, 'rel_trg'),
    embeddingSimilarity(wa, wb),
  ]);

  const datuseScore = Math.max(
    mlA.get(wb) ?? 0,
    trgA.get(wb) ?? 0,
    mlB.get(wa) ?? 0,
    trgB.get(wa) ?? 0,
  );

  const embeddingScore = cos === null ? 0 : normalizeCosine(cos);
  return Math.max(datuseScore, embeddingScore);
}
