/**
 * Word lookups for validation and the 📖 Dict panel.
 * Two sources: dictionaryapi.dev (rich definitions, often down) and Datamuse (fast,
 * reliable, short definitions). Both are queried in parallel; a source that keeps
 * failing is skipped for a while so nobody waits on its timeout.
 */

const DICTIONARY_TIMEOUT_MS = 3000;
const DATAMUSE_TIMEOUT_MS = 5000;
/** After this many failures in a row a source is skipped for SKIP_MS. */
const FAIL_LIMIT = 2;
const SKIP_MS = 5 * 60 * 1000;

export type WordCheckResult = 'valid' | 'not_found' | 'network_error';

export interface WordEntry {
  definition: string;
  partOfSpeech: string;
}

/** Result from one source; 'unavailable' means it couldn't answer (down, slow, bad response). */
type Lookup = { status: 'found'; entry: WordEntry } | { status: 'not_found' } | { status: 'unavailable' };

class SourceHealth {
  private fails = 0;
  private skipUntil = 0;
  get skipped() {
    return Date.now() < this.skipUntil;
  }
  record(result: Lookup) {
    if (result.status === 'unavailable') {
      this.fails++;
      if (this.fails >= FAIL_LIMIT) this.skipUntil = Date.now() + SKIP_MS;
    } else {
      this.fails = 0;
      this.skipUntil = 0;
    }
  }
}

const dictionaryHealth = new SourceHealth();
const datamuseHealth = new SourceHealth();

/** Test hook: forget cached lookups and source health. */
export function resetDictionaryState() {
  lookupCache.clear();
  Object.assign(dictionaryHealth, new SourceHealth());
  Object.assign(datamuseHealth, new SourceHealth());
}

/** fetch that gives up after `ms`, and also when the caller's signal aborts. */
async function fetchWithTimeout(url: string, ms: number, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

async function fromDictionaryApi(word: string, signal?: AbortSignal): Promise<Lookup> {
  try {
    const res = await fetchWithTimeout(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      DICTIONARY_TIMEOUT_MS,
      signal,
    );
    // When the service is down it serves an HTML error page (also with 404),
    // so only trust a JSON response either way.
    const isJson = res.headers.get('content-type')?.includes('application/json') ?? false;
    if (!isJson) return { status: 'unavailable' };
    if (res.status === 404) return { status: 'not_found' };
    if (!res.ok) return { status: 'unavailable' };
    const data = (await res.json()) as Array<{
      meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string }> }>;
    }>;
    const meaning = data[0]?.meanings?.[0];
    return {
      status: 'found',
      entry: {
        definition: meaning?.definitions?.[0]?.definition ?? 'No definition found.',
        partOfSpeech: meaning?.partOfSpeech ?? '',
      },
    };
  } catch {
    return { status: 'unavailable' };
  }
}

const DATAMUSE_POS: Record<string, string> = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };

async function fromDatamuse(word: string, signal?: AbortSignal): Promise<Lookup> {
  try {
    const res = await fetchWithTimeout(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=dp&max=1`,
      DATAMUSE_TIMEOUT_MS,
      signal,
    );
    if (!res.ok) return { status: 'unavailable' };
    const [match] = (await res.json()) as Array<{ word: string; tags?: string[]; defs?: string[] }>;
    // Exact spelling, has a definition, and isn't a proper noun (place/person names)
    if (match?.word !== word || !match.defs?.length || (match.tags ?? []).includes('prop')) {
      return { status: 'not_found' };
    }
    // Datamuse definitions look like "n\tA small insect…"
    const [pos, ...rest] = match.defs[0].split('\t');
    return {
      status: 'found',
      entry: { definition: rest.join('\t').trim() || match.defs[0], partOfSpeech: DATAMUSE_POS[pos] ?? pos },
    };
  } catch {
    return { status: 'unavailable' };
  }
}

const lookupCache = new Map<string, Promise<Lookup>>();

/**
 * Looks a word up in both sources at once and resolves with the first one that finds
 * it; 'not_found' only when no source found it and at least one answered.
 */
function lookup(rawWord: string, signal?: AbortSignal): Promise<Lookup> {
  const word = rawWord.trim().toLowerCase();
  const cached = lookupCache.get(word);
  if (cached) return cached;

  const sources: Array<[SourceHealth, typeof fromDatamuse]> = [
    [dictionaryHealth, fromDictionaryApi],
    [datamuseHealth, fromDatamuse],
  ];
  const active = sources.filter(([health]) => !health.skipped);
  // If every source is being skipped, try them all anyway rather than fail outright
  const toRun = active.length > 0 ? active : sources;

  const promise = new Promise<Lookup>((resolve) => {
    let pending = toRun.length;
    let anyAnswered = false;
    for (const [health, fn] of toRun) {
      fn(word, signal).then((result) => {
        health.record(result);
        if (result.status === 'found') resolve(result);
        if (result.status === 'not_found') anyAnswered = true;
        if (--pending === 0) resolve(anyAnswered ? { status: 'not_found' } : { status: 'unavailable' });
      });
    }
  });

  // Cache definitive answers only, so a network blip can be retried
  lookupCache.set(word, promise);
  promise.then((r) => {
    if (r.status === 'unavailable') lookupCache.delete(word);
  });
  return promise;
}

/** Whether a word exists in the English dictionary. */
export async function checkRealWord(word: string, signal?: AbortSignal): Promise<WordCheckResult> {
  if (signal?.aborted) return 'network_error';
  const result = await lookup(word, signal);
  if (result.status === 'found') return 'valid';
  return result.status === 'not_found' ? 'not_found' : 'network_error';
}

/** Definition for the 📖 Dict panel, or null when no source has one. */
export async function lookupDefinition(word: string): Promise<WordEntry | null> {
  const result = await lookup(word);
  return result.status === 'found' ? result.entry : null;
}
