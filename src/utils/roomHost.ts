import type { Room } from '../types';

/**
 * Who runs the room right now. Rooms stay open when everyone leaves, so the stored host may
 * not be seated; then the longest-seated player (players before spectators) acts as host:
 * starts rounds, detects wins and sees the host controls. `hostId` itself is not changed —
 * the database rules only let the host hand it over — so the real host gets the room back
 * when they return.
 */
export function activeHostId(room: Pick<Room, 'hostId' | 'players'> | null | undefined): string | null {
  if (!room) return null;
  const players = room.players ?? {};
  if (players[room.hostId]) return room.hostId;
  const seated = Object.values(players).sort(
    (a, b) => Number(!!a.spectator) - Number(!!b.spectator) || a.joinedAt - b.joinedAt || a.id.localeCompare(b.id),
  );
  return seated[0]?.id ?? null;
}

export function isActiveHost(room: Pick<Room, 'hostId' | 'players'> | null | undefined, playerId: string | null | undefined): boolean {
  return !!playerId && activeHostId(room) === playerId;
}
