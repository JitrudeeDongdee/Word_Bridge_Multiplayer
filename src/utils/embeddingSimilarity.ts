import type { FeatureExtractionPipeline } from '@huggingface/transformers';

// Small sentence-embedding model (~23MB quantized) that runs in the browser via
// WebAssembly. Downloaded from the Hugging Face hub on first use, then served
// from the browser cache on later visits.
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

let extractorPromise: Promise<FeatureExtractionPipeline | null> | null = null;

// Module-level cache: word → embedding (unit vector)
const embeddingCache = new Map<string, Promise<Float32Array | null>>();

function getExtractor(): Promise<FeatureExtractionPipeline | null> {
  if (!extractorPromise) {
    extractorPromise = import('@huggingface/transformers')
      .then(async ({ pipeline, env }) => {
        env.allowLocalModels = false;
        return (await pipeline('feature-extraction', MODEL_ID, {
          dtype: 'q8',
        })) as FeatureExtractionPipeline;
      })
      .catch((err) => {
        console.warn('[embedding] model failed to load, falling back to Datamuse only', err);
        return null;
      });
  }
  return extractorPromise;
}

/** Starts downloading the model in the background so the first word isn't slow. */
export function preloadEmbeddingModel(): void {
  void getExtractor();
}

function embed(word: string): Promise<Float32Array | null> {
  const cached = embeddingCache.get(word);
  if (cached) return cached;

  const promise = getExtractor().then(async (extractor) => {
    if (!extractor) return null;
    try {
      const output = await extractor(word, { pooling: 'mean', normalize: true });
      return output.data as Float32Array;
    } catch {
      return null;
    }
  });
  embeddingCache.set(word, promise);
  return promise;
}

/**
 * Cosine similarity [-1, 1] between two words' embeddings,
 * or null if the model is unavailable.
 */
export async function embeddingSimilarity(a: string, b: string): Promise<number | null> {
  const [ea, eb] = await Promise.all([embed(a), embed(b)]);
  if (!ea || !eb) return null;
  let dot = 0;
  for (let i = 0; i < ea.length; i++) dot += ea[i] * eb[i];
  return dot;
}
