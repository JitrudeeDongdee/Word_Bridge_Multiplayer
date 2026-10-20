import { ref, get, set, remove, onValue } from 'firebase/database';
import { db } from './firebase';
import type { Room, RoomIndexEntry } from '../types';

const INDEX_PATH = 'roomIndex';

/** Rooms idle longer than this are hidden from the list (cleanOldRooms deletes them later). */
export const ROOM_LIST_MAX_IDLE_MS = 2 * 60 * 60 * 1000;

export function defaultRoomName(hostName: string): string {
  return `${hostName}'s room`;
}

export function toIndexEntry(room: Room): RoomIndexEntry {
  const players = Object.values(room.players ?? {});
  const host = room.players?.[room.hostId];
  return {
    id: room.id,
    name: room.name || defaultRoomName(host?.name ?? 'Someone'),
    hostName: host?.name ?? '',
    playerCount: players.length,
    status: room.status,
    hasPassword: !!room.passwordHash,
    lastActiveAt: room.lastActiveAt ?? room.createdAt ?? Date.now(),
  };
}

/**
 * Rewrites a room's public summary from its current data (or removes it if the room is
 * gone). Called after anything that changes the name, players, host or status.
 * Best effort: a failure here must never break the game action that triggered it.
 */
export async function syncRoomIndex(roomId: string): Promise<void> {
  try {
    const snap = await get(ref(db, `rooms/${roomId}`));
    if (!snap.exists()) {
      await remove(ref(db, `${INDEX_PATH}/${roomId}`));
      return;
    }
    await set(ref(db, `${INDEX_PATH}/${roomId}`), toIndexEntry(snap.val() as Room));
  } catch (err) {
    console.warn('[roomIndex] sync failed', err);
  }
}

export async function removeFromRoomIndex(roomIds: string[]): Promise<void> {
  await Promise.all(roomIds.map((id) => remove(ref(db, `${INDEX_PATH}/${id}`)).catch(() => {})));
}

/** Index entries whose room no longer exists (e.g. deleted before the index existed). */
export async function findOrphanIndexIds(existingRoomIds: Set<string>): Promise<string[]> {
  const snap = await get(ref(db, INDEX_PATH));
  return Object.keys((snap.val() as Record<string, unknown> | null) ?? {}).filter(
    (id) => !existingRoomIds.has(id),
  );
}

/** Orders the public list: waiting rooms first, then most recently active. */
export function sortRoomList(entries: RoomIndexEntry[], now = Date.now()): RoomIndexEntry[] {
  const rank = (e: RoomIndexEntry) => (e.status === 'waiting' ? 0 : 1);
  return entries
    // Empty rooms stay listed (people can come back to them) until they go idle
    .filter((e) => now - e.lastActiveAt < ROOM_LIST_MAX_IDLE_MS)
    .sort((a, b) => rank(a) - rank(b) || b.lastActiveAt - a.lastActiveAt);
}

/** Live public room list. `onError` fires e.g. when the database rules don't allow it yet. */
export function subscribeRoomIndex(
  callback: (entries: RoomIndexEntry[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return onValue(
    ref(db, INDEX_PATH),
    (snap) => callback(sortRoomList(Object.values((snap.val() as Record<string, RoomIndexEntry> | null) ?? {}))),
    (err) => onError?.(err),
  );
}

/** Message for a failed join (see JoinRoomResult). */
export function joinErrorMessage(reason: 'not_found' | 'password_required' | 'wrong_password'): string {
  switch (reason) {
    case 'not_found':
      return 'Room not found.';
    case 'password_required':
      return 'This room is locked — enter its password.';
    case 'wrong_password':
      return 'Wrong password.';
  }
}

/** Rooms whose name, host name or room code contains the query (case-insensitive). */
export function filterRooms(entries: RoomIndexEntry[], query: string): RoomIndexEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) =>
    [e.name, e.hostName, e.id].some((field) => field.toLowerCase().includes(q)),
  );
}
