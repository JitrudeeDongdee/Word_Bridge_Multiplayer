/** Returns the set of character bigrams for a word. */
function getBigrams(word: string): Set<string> {
  const lower = word.toLowerCase();
  const bigrams = new Set<string>();
  for (let i = 0; i < lower.length - 1; i++) {
    bigrams.add(lower.slice(i, i + 2));
  }
  return bigrams;
}

/**
 * Jaccard similarity between two words based on character bigrams.
 * Returns a value in [0, 1]. Higher = more similar.
 */
export function bigramJaccard(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return 0;
  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);
  const intersection = [...bigramsA].filter((bg) => bigramsB.has(bg)).length;
  const union = new Set([...bigramsA, ...bigramsB]).size;
  return union === 0 ? 0 : intersection / union;
}
