import type { Player } from '../types';

interface PlayerListProps {
  players: Record<string, Player>;
  currentPlayerId: string | null;
  hostId?: string;
  onKick?: (playerId: string) => void;
  onApprove?: (playerId: string) => void;
  onDeny?: (playerId: string) => void;
  playerColorMap?: Record<string, string>;
}

export default function PlayerList({ players, currentPlayerId, hostId, onKick, onApprove, onDeny, playerColorMap = {} }: PlayerListProps) {
  const sorted = Object.values(players).sort((a, b) => a.joinedAt - b.joinedAt);
  const isHost = currentPlayerId === hostId;

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((player) => (
        <div key={player.id} className="flex flex-col rounded-lg bg-gray-50 border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: playerColorMap[player.id] ?? '#d1d5db' }}
            />
            <span className="text-sm text-gray-800 flex-1 truncate">{player.name}</span>
            {player.spectator && !player.joinRequest && (
              <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">
                Watching
              </span>
            )}
            {player.joinRequest && player.id === currentPlayerId && (
              <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Requested</span>
            )}
            {player.isHost && (
              <span className="text-xs font-medium text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded">
                Host
              </span>
            )}
            {player.id === currentPlayerId && (
              <span className="text-xs text-gray-400">(you)</span>
            )}
            {isHost && onKick && player.id !== currentPlayerId && !player.joinRequest && (
              <button
                onClick={() => onKick(player.id)}
                className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors ml-1"
                title={player.spectator ? 'Remove spectator' : 'Kick player'}
              >
                {player.spectator ? 'Remove' : 'Kick'}
              </button>
            )}
          </div>
          {isHost && player.joinRequest && player.id !== currentPlayerId && (
            <div className="flex border-t border-blue-100">
              <button
                onClick={() => onApprove?.(player.id)}
                className="flex-1 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => onDeny?.(player.id)}
                className="flex-1 py-1.5 bg-red-400 hover:bg-red-500 text-white text-xs font-semibold transition-colors border-l border-white/30"
              >
                Deny
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
