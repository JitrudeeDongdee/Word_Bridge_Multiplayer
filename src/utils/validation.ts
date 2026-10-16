import type { GameNode } from '../types';

const WORD_REGEX = /^[a-zA-Z]+$/;
const MIN_LENGTH = 2;
const MAX_LENGTH = 30;
const MAX_NODES = 50;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateWord(
  word: string,
  existingNodes: GameNode[],
): ValidationResult {
  const trimmed = word.trim();

  if (!trimmed) {
    return { valid: false, error: 'Word cannot be empty.' };
  }

  if (!WORD_REGEX.test(trimmed)) {
    return { valid: false, error: 'Only English letters are allowed.' };
  }

  if (trimmed.length < MIN_LENGTH) {
    return { valid: false, error: `Word must be at least ${MIN_LENGTH} characters.` };
  }

  if (trimmed.length > MAX_LENGTH) {
    return { valid: false, error: `Word must be no longer than ${MAX_LENGTH} characters.` };
  }

  const lower = trimmed.toLowerCase();
  const isDuplicate = existingNodes.some((n) => n.word.toLowerCase() === lower);
  if (isDuplicate) {
    return { valid: false, error: `"${trimmed}" is already on the canvas.` };
  }

  if (existingNodes.length >= MAX_NODES) {
    return { valid: false, error: `Maximum of ${MAX_NODES} nodes reached.` };
  }

  return { valid: true };
}

export type WordCheckResult = 'valid' | 'not_found' | 'network_error';

const DICTIONARY_TIMEOUT_MS = 3000;
const FALLBACK_TIMEOUT_MS = 5000;

/** Result from one source; 'unavailable' means ask the next source. */
type SourceResult = 'valid' | 'not_found' | 'unavailable';

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

async function checkDictionaryApi(word: string, signal?: AbortSignal): Promise<SourceResult> {
  try {
    const res = await fetchWithTimeout(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      DICTIONARY_TIMEOUT_MS,
      signal,
    );
    // When the service is down it serves an HTML error page (also with 404),
    // so only trust a JSON response either way.
    const isJson = res.headers.get('content-type')?.includes('application/json') ?? false;
    if (!isJson) return 'unavailable';
    if (res.ok) return 'valid';
    return res.status === 404 ? 'not_found' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

interface DatamuseWord {
  word: string;
  tags?: string[];
  defs?: string[];
}

async function checkDatamuse(word: string, signal?: AbortSignal): Promise<SourceResult> {
  try {
    const res = await fetchWithTimeout(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=dp&max=1`,
      FALLBACK_TIMEOUT_MS,
      signal,
    );
    if (!res.ok) return 'unavailable';
    const [match] = (await res.json()) as DatamuseWord[];
    // Exact spelling, has a definition, and isn't a proper noun (place/person names)
    const isWord =
      match?.word === word &&
      (match.defs?.length ?? 0) > 0 &&
      !(match.tags ?? []).includes('prop');
    return isWord ? 'valid' : 'not_found';
  } catch {
    return 'unavailable';
  }
}

/**
 * Checks whether a word exists in the English dictionary.
 * Uses dictionaryapi.dev, falling back to Datamuse when it is down or slow.
 */
export async function checkRealWord(word: string, signal?: AbortSignal): Promise<WordCheckResult> {
  const lower = word.toLowerCase();
  for (const source of [checkDictionaryApi, checkDatamuse]) {
    if (signal?.aborted) return 'network_error';
    const result = await source(lower, signal);
    if (result !== 'unavailable') return result;
  }
  return 'network_error';
}
