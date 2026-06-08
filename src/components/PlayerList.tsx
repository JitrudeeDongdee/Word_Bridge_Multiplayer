import type { Player } from '../types';

interface PlayerListProps {
  players: Record<string, Player>;
  currentPlayerId: string | null;
}

export default function PlayerList({ players, currentPlayerId }: PlayerListProps) {
  const sorted = Object.values(players).sort((a, b) => a.joinedAt - b.joinedAt);

  return (
    <ul className="space-y-2">
      {sorted.map((player) => (
        <li
          key={player.id}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200"
        >
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              player.id === currentPlayerId ? 'bg-green-400' : 'bg-gray-300'
            }`}
          />
          <span className="text-sm text-gray-800 flex-1 truncate">{player.name}</span>
          {player.isHost && (
            <span className="text-xs font-medium text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded">
              Host
            </span>
          )}
          {player.id === currentPlayerId && (
            <span className="text-xs text-gray-400">(you)</span>
          )}
        </li>
      ))}
    </ul>
  );
}
