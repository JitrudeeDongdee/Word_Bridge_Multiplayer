import type { Player } from '../types';

export const PLAYER_COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

/** Maps each playerId → a distinct hex color, ordered by join time. */
export function getPlayerColorMap(
  players: Record<string, Player>,
): Record<string, string> {
  const sorted = Object.values(players).sort((a, b) => a.joinedAt - b.joinedAt);
  return Object.fromEntries(
    sorted.map((p, i) => [p.id, PLAYER_COLORS[i % PLAYER_COLORS.length]]),
  );
}
