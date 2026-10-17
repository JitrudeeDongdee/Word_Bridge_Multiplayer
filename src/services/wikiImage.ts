/**
 * Illustrative image for a word, from the Wikipedia page summary API
 * (free, no key, CORS-enabled). Returns null for pages without an image and for
 * disambiguation pages (e.g. "run"), where any image would be a guess.
 */

const TIMEOUT_MS = 4000;

export interface WikiImage {
  /** Thumbnail URL (~320px) */
  src: string;
  /** Article the image comes from — linked under the image as attribution */
  pageUrl: string;
  /** Article title, e.g. "Happiness" for "happy" */
  title: string;
}

interface SummaryResponse {
  type?: string;
  title?: string;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
}

const cache = new Map<string, Promise<WikiImage | null>>();

async function fetchImage(word: string): Promise<WikiImage | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(word)}`,
      { signal: controller.signal },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as SummaryResponse;
    const src = data.thumbnail?.source;
    if (data.type === 'disambiguation' || !src) return null;
    return {
      src,
      pageUrl:
        data.content_urls?.desktop?.page ??
        `https://en.wikipedia.org/wiki/${encodeURIComponent(word)}`,
      title: data.title ?? word,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function lookupWikiImage(rawWord: string): Promise<WikiImage | null> {
  const word = rawWord.trim().toLowerCase();
  let promise = cache.get(word);
  if (!promise) {
    promise = fetchImage(word);
    cache.set(word, promise);
  }
  return promise;
}
