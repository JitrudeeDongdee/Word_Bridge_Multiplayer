import { onValue, push, ref, remove, set } from 'firebase/database';
import { db } from './firebase';
import type { ChatMessage } from '../types';

/**
 * Chat safety (Google Play's user-generated-content policy):
 * - Block: `blocks/{myUid}/{theirUid}` — only you can read or change your list; their chat
 *   messages are hidden from you in every room.
 * - Report: `reports/{id}` — write-only for players; the owner reviews them in the Firebase console.
 */

export const REPORT_REASONS = [
  { id: 'harassment', label: 'Harassment or hate' },
  { id: 'sexual', label: 'Sexual content' },
  { id: 'spam', label: 'Spam or scam' },
  { id: 'other', label: 'Something else' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['id'];

export interface BlockedPlayer {
  name: string;
  at: number;
}

export function subscribeBlocks(uid: string, onBlocks: (blocks: Record<string, BlockedPlayer>) => void): () => void {
  return onValue(
    ref(db, `blocks/${uid}`),
    (snap) => onBlocks((snap.val() ?? {}) as Record<string, BlockedPlayer>),
    () => onBlocks({}),
  );
}

export function blockPlayer(uid: string, other: { id: string; name: string }): Promise<void> {
  return set(ref(db, `blocks/${uid}/${other.id}`), { name: other.name.slice(0, 30), at: Date.now() });
}

export function unblockPlayer(uid: string, otherId: string): Promise<void> {
  return remove(ref(db, `blocks/${uid}/${otherId}`));
}

export async function reportMessage(reporterId: string, roomId: string, msg: ChatMessage, reason: ReportReason): Promise<void> {
  await push(ref(db, 'reports'), {
    reporterId,
    reportedId: msg.playerId,
    reportedName: msg.playerName.slice(0, 30),
    roomId,
    messageId: msg.id,
    text: msg.text.slice(0, 200),
    sentAt: msg.sentAt,
    reason,
    at: Date.now(),
  });
}

/** Messages minus those from blocked players, plus who was hidden (to offer "Unblock"). */
export function hideBlocked(messages: ChatMessage[], blocked: Record<string, unknown>): {
  visible: ChatMessage[];
  hiddenFrom: { id: string; name: string }[];
} {
  const hidden = new Map<string, string>();
  const visible = messages.filter((m) => {
    if (!(m.playerId in blocked)) return true;
    hidden.set(m.playerId, m.playerName);
    return false;
  });
  return { visible, hiddenFrom: [...hidden].map(([id, name]) => ({ id, name })) };
}
