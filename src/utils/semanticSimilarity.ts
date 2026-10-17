import { embeddingSimilarity } from './embeddingSimilarity';

const TIMEOUT_MS = 3000;

/** Score (on the [0, 1] scale returned by semanticSimilarity) at which two words get auto-bridged. */
export const AUTO_BRIDGE_THRESHOLD = 0.15;

// Cosine similarity at which the embedding alone counts two words as related.
// all-MiniLM-L6-v2 is weak on single words: any two common nouns tend to score
// 0.35–0.45 (measured 2026-10-17 on 1,500 random start-word pairs: 11% reach 0.35,
// 4.3% reach 0.40, 1.5% reach 0.45; dog–king 0.392, puppet–dog 0.418). 0.35 let
// generic words like "rock" bridge 58% of start pairs in one word, so the bar is
// 0.45. Real but weaker associations (coffee–morning 0.357) must come from Datamuse
// or player votes. bge-small and gte-small separated no better.
export const EMBEDDING_RELATED_COSINE = 0.45;

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

export interface PairScore {
  /** Final relatedness [0, 1]: the higher of the two sources */
  score: number;
  /** Datamuse score [0, 1]; 0 when Datamuse knows no relation */
  datamuse: number;
  /** Raw embedding cosine, or null if the model is unavailable */
  embedding: number | null;
}

/**
 * Semantic relatedness of two English words with the score from each source.
 * Combines Datamuse API (means-like + triggers; precise, but only knows listed
 * associations) with an in-browser embedding model (any pair, but noisy — see
 * EMBEDDING_RELATED_COSINE), taking whichever is higher.
 * If the model fails to load, Datamuse alone is used.
 * Results are cached in memory so each pair is only fetched once per session.
 */
export async function semanticScores(a: string, b: string): Promise<PairScore> {
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
  return { score: Math.max(datuseScore, embeddingScore), datamuse: datuseScore, embedding: cos };
}

/** Semantic relatedness [0, 1] between two English words (see semanticScores). */
export async function semanticSimilarity(a: string, b: string): Promise<number> {
  return (await semanticScores(a, b)).score;
}
