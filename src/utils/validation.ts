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

/**
 * Checks whether a word exists in the English dictionary
 * using the free dictionaryapi.dev API.
 */
export async function checkRealWord(word: string): Promise<WordCheckResult> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`,
    );
    return res.ok ? 'valid' : 'not_found';
  } catch {
    return 'network_error';
  }
}
