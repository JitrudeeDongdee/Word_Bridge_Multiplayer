import PlayerList from './PlayerList';
import ScoreTable from './ScoreTable';
import type { Room } from '../types';
import { approveJoinRequest, denyJoinRequest, kickPlayer } from '../services/roomService';

interface GameSidebarProps {
  room: Room;
  roomId: string;
  playerId: string;
  isOpen: boolean;
  isHost: boolean;
  leavingLobby: boolean;
  leaving: boolean;
  copied: boolean;
  selectedNodeId: string | null;
  playerColorMap: Record<string, string>;
  onClose: () => void;
  onCopyLink: () => void;
  onNewGame: () => void;
  onBackToLobby: () => void;
}

export default function GameSidebar({
  room, roomId, playerId,
  isOpen, isHost,
  leavingLobby, leaving, copied,
  selectedNodeId, playerColorMap,
  onClose, onCopyLink, onNewGame, onBackToLobby,
}: GameSidebarProps) {
  const { wordA = '?', wordB = '?' } = room.gameState ?? {};
  const nodeCount = Object.keys(room.nodes ?? {}).length;

  return (
    <aside
      className={[
        'fixed top-0 right-0 bottom-0 z-40 w-72 max-w-[85vw] bg-white border-l border-gray-200 shadow-xl flex flex-col overflow-hidden',
        'transform transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}
    >
      {/* Scrollable upper content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-4 p-4">
      {/* Top section: word pair + close; host actions on mobile (desktop has them in the header) */}
      <div className="border-b border-gray-100 pb-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">
            <span className="text-brand-500 uppercase">{wordA}</span>
            <span className="mx-1.5 text-gray-400 font-normal">→</span>
            <span className="text-brand-500 uppercase">{wordB}</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{nodeCount} nodes</span>
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
        {isHost && (
          <div className="flex gap-2 md:hidden">
            <button
              onClick={onNewGame}
              disabled={leavingLobby || leaving}
              className="flex-1 px-2 py-1.5 rounded-lg border border-brand-300 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 transition-colors"
            >
              ↺ New Game
            </button>
            <button
              onClick={onBackToLobby}
              disabled={leavingLobby || leaving}
              className="flex-1 px-2 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              {leavingLobby ? 'Returning…' : '← Lobby'}
            </button>
          </div>
        )}
        <button
          onClick={onCopyLink}
          className="md:hidden w-full py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
        >
          <span>{copied ? '✓' : '🔗'}</span>
          <span>{copied ? 'Copied!' : 'Copy Invite Link'}</span>
        </button>
      </div>

      {/* Players */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Players</p>
        <PlayerList
          players={room.players ?? {}}
          currentPlayerId={playerId}
          hostId={room.hostId}
          playerColorMap={playerColorMap}
          onApprove={isHost ? (pid) => approveJoinRequest(roomId, pid) : undefined}
          onDeny={isHost ? (pid) => denyJoinRequest(roomId, pid) : undefined}
          onKick={isHost ? (pid) => kickPlayer(roomId, pid) : undefined}
        />
      </div>

      {/* Scores */}
      {((room.scores && Object.keys(room.scores).length > 0) || Object.keys(room.edges ?? {}).length > 0) && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Scores</p>
          {room.scores && Object.keys(room.scores).length > 0 && (
            <div className="flex flex-col gap-1 mb-3">
              {Object.entries(room.scores)
                .sort(([, a], [, b]) => b - a)
                .map(([pid, pts], rank) => {
                  const color = playerColorMap[pid] ?? '#94a3b8';
                  const name = room.players?.[pid]?.name ?? pid;
                  return (
                    <div key={pid} className="flex items-center justify-between py-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400 w-3">{rank + 1}.</span>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs text-gray-700 truncate max-w-[110px]">{name}</span>
                      </span>
                      <span className="text-xs font-bold text-gray-800">{pts}</span>
                    </div>
                  );
                })}
            </div>
          )}
          <ScoreTable
            nodes={room.nodes ?? {}}
            edges={room.edges ?? {}}
            startWords={room.gameState ? [room.gameState.wordA, room.gameState.wordB] : []}
            highlightNodeId={selectedNodeId}
          />
        </div>
      )}

      <div className="mt-auto pt-2">
        <p className="text-xs text-gray-400">
          Drag nodes to rearrange. You can only delete your own nodes.
        </p>
      </div>
      </div>{/* end scrollable upper content */}

    </aside>
  );
}
