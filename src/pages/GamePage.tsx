import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { useRoomSubscription } from '../hooks/useRoomSubscription';
import { useWinDetection } from '../hooks/useWinDetection';
import GameCanvas from '../components/GameCanvas';
import AddWordPanel from '../components/AddWordPanel';
import PlayerList from '../components/PlayerList';
import ScoreTable from '../components/ScoreTable';
import VictoryModal from '../components/VictoryModal';
import NewGameModal from '../components/NewGameModal';
import { getPlayerColorMap } from '../utils/playerColors';
import { resetToLobby } from '../services/roomService';

export default function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);

  useRoomSubscription(roomId);
  useWinDetection(roomId ?? '');

  const [leavingLobby, setLeavingLobby] = useState(false);
  const [showNewGameModal, setShowNewGameModal] = useState(false);

  const playerColorMap = useMemo(
    () => getPlayerColorMap(room?.players ?? {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room?.players],
  );

  const isHost = room?.hostId === playerId;

  const handleBackToLobby = async () => {
    if (!roomId) return;
    setLeavingLobby(true);
    try {
      await resetToLobby(roomId);
      // navigation happens via useRoomSubscription watching status === 'waiting'
    } catch {
      setLeavingLobby(false);
    }
  };



  if (!room || !roomId || !playerId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading game…
      </div>
    );
  }

  const { wordA, wordB } = room.gameState ?? { wordA: '?', wordB: '?' };
  const nodeCount = Object.keys(room.nodes ?? {}).length;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="font-black text-brand-600 text-xl">Word Bridge</span>
          <span className="text-gray-300">|</span>
          <span className="font-mono text-sm text-gray-500">{roomId}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>
            <span className="font-bold text-brand-500 uppercase">{wordA}</span>
            <span className="mx-2 text-gray-400">→</span>
            <span className="font-bold text-brand-500 uppercase">{wordB}</span>
          </span>
          <span className="text-gray-400">{nodeCount} nodes</span>
          {isHost && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNewGameModal(true)}
                disabled={leavingLobby}
                className="px-3 py-1 rounded-lg border border-brand-300 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 transition-colors"
              >
                ↺ New Game
              </button>
              <button
                onClick={handleBackToLobby}
                disabled={leavingLobby}
                className="px-3 py-1 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                {leavingLobby ? 'Returning…' : '← Back to Lobby'}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <main className="flex-1 relative">
          <GameCanvas room={room} roomId={roomId} playerId={playerId} playerColorMap={playerColorMap} />
          {/* Victory modal — mounts when game is won, unmounts on restart */}
          {showNewGameModal && room.status === 'playing' && (
            <NewGameModal
              room={room}
              roomId={roomId}
              playerId={playerId}
              playerColorMap={playerColorMap}
              onClose={() => setShowNewGameModal(false)}
            />
          )}
          {room.status === 'won' && (
            <VictoryModal
              room={room}
              roomId={roomId}
              playerId={playerId}
              playerColorMap={playerColorMap}
            />
          )}
        </main>
        {/* Sidebar */}
        <aside className="w-64 bg-white border-l border-gray-200 flex flex-col gap-4 p-4 overflow-y-auto">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Add Word
            </p>
            <AddWordPanel roomId={roomId} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Players
            </p>
            <PlayerList players={room.players ?? {}} currentPlayerId={playerId} playerColorMap={playerColorMap} />
          </div>

          {/* Cumulative scores — visible once any player has earned points */}
          {room.scores && Object.keys(room.scores).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Scores
              </p>
              <div className="flex flex-col gap-1">
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
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Last Word Scores
            </p>
            <ScoreTable lastWordScores={room.lastWordScores ?? null} />
          </div>
          <div className="mt-auto">
            <p className="text-xs text-gray-400">
              Drag nodes to rearrange.
              You can only delete your own nodes.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
