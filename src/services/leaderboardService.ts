import { get, limitToLast, onValue, orderByChild, query, ref, set, startAt, update } from 'firebase/database';
import { db } from './firebase';
import { roundCrowns, type WinLogEntry } from '../utils/leaderboard';
import type { Player } from '../types';

const LOG_PATH = 'winLog';
const PUBLIC_PATH = 'publicProfiles';
/** Cap on rounds read for a board (all-time grows forever; newest first) */
const MAX_ROUNDS = 5000;

export interface PublicProfile {
  name: string;
  photo?: string;
}

/**
 * Logs a finished round for the leaderboard, once per round (key: room + round start).
 * Called by the host's client right after it marks the room won.
 */
export async function logRound(roomId: string, roundScores: Record<string, number>): Promise<void> {
  const roomSnap = await get(ref(db, `rooms/${roomId}`));
  if (!roomSnap.exists()) return;
  const room = roomSnap.val() as { gameState?: { startedAt?: number }; players?: Record<string, Player> };
  const startedAt = room.gameState?.startedAt ?? Date.now();
  const scores: Record<string, number> = {};
  const names: Record<string, string> = {};
  for (const [uid, pts] of Object.entries(roundScores)) {
    scores[uid] = Math.round(pts * 10) / 10;
    names[uid] = (room.players?.[uid]?.name ?? 'Player').slice(0, 30);
  }
  const crowns = Object.fromEntries(roundCrowns(scores).map((uid) => [uid, true as const]));
  const entry: WinLogEntry = { roomId, at: Date.now(), scores, names, ...(Object.keys(crowns).length ? { crowns } : {}) };
  // The rules refuse a second write for the same round, which is fine (already logged)
  await set(ref(db, `${LOG_PATH}/${roomId}_${startedAt}`), entry).catch(() => {});
}

/** Rounds since `since` (0 = all time), kept live. */
export function subscribeRounds(since: number, onRounds: (rounds: WinLogEntry[]) => void): () => void {
  const q = since > 0
    ? query(ref(db, LOG_PATH), orderByChild('at'), startAt(since), limitToLast(MAX_ROUNDS))
    : query(ref(db, LOG_PATH), orderByChild('at'), limitToLast(MAX_ROUNDS));
  return onValue(q, (snap) => onRounds(Object.values((snap.val() ?? {}) as Record<string, WinLogEntry>)), () => onRounds([]));
}

/** Name + picture other players may see (users/{uid} itself stays private). */
export async function savePublicProfile(uid: string, profile: { name?: string; photo?: string | null }): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (profile.name !== undefined) patch.name = profile.name.slice(0, 20);
  if (profile.photo !== undefined) patch.photo = profile.photo;
  if (Object.keys(patch).length) await update(ref(db, `${PUBLIC_PATH}/${uid}`), patch);
}

export async function loadPublicProfiles(uids: string[]): Promise<Record<string, PublicProfile>> {
  const out: Record<string, PublicProfile> = {};
  await Promise.all(uids.map(async (uid) => {
    const snap = await get(ref(db, `${PUBLIC_PATH}/${uid}`)).catch(() => null);
    if (snap?.exists()) out[uid] = snap.val() as PublicProfile;
  }));
  return out;
}
