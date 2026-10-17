import type { GameNode } from '../types';

const WORD_REGEX = /^[a-zA-Z]+$/;
const MIN_LENGTH = 2;
const MAX_LENGTH = 30;
const MAX_NODES = 50;
/** Words each player may have on the canvas per round (deleting one frees a slot) */
export const MAX_WORDS_PER_PLAYER = 5;

/** How many more words this player may add this round. */
export function wordsLeft(existingNodes: GameNode[], playerId: string): number {
  const used = existingNodes.filter((n) => !n.isStart && n.createdBy === playerId).length;
  return Math.max(0, MAX_WORDS_PER_PLAYER - used);
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateWord(
  word: string,
  existingNodes: GameNode[],
  playerId?: string,
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

  if (playerId && wordsLeft(existingNodes, playerId) === 0) {
    return {
      valid: false,
      error: `You've used all ${MAX_WORDS_PER_PLAYER} words this round. Delete one of yours to add another.`,
    };
  }

  return { valid: true };
}

// Dictionary lookups live in services/dictionary (shared with the 📖 Dict panel)
export { checkRealWord, type WordCheckResult } from '../services/dictionary';
