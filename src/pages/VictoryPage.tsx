import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { useRoomSubscription } from '../hooks/useRoomSubscription';
import { restartGame } from '../services/roomService';
import { getPlayerColorMap } from '../utils/playerColors';

export default function VictoryPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const [restarting, setRestarting] = useState(false);

  useRoomSubscription(roomId);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const playerColorMap = useMemo(() => getPlayerColorMap(room?.players ?? {}), [room?.players]);

  // When host restarts, all players auto-navigate back to the game
  useEffect(() => {
    if (room?.status === 'playing') {
      navigate(`/game/${roomId}`);
    }
  }, [room?.status, roomId, navigate]);

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  const { gameState, nodes, winningPath } = room;
  const wordA = gameState?.wordA ?? '?';
  const wordB = gameState?.wordB ?? '?';
  const isHost = room.hostId === playerId;

  const path = winningPath ?? [];

  const handlePlayAgain = async () => {
    setRestarting(true);
    try {
      await restartGame(roomId!);
    } catch {
      setRestarting(false);
    }
  };

  // Sort scores descending
  const roundEntries = Object.entries(room.roundScores ?? {}).sort(([, a], [, b]) => b - a);
  const totalEntries = Object.entries(room.scores ?? {}).sort(([, a], [, b]) => b - a);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-sky-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg text-center">
        <div className="bg-white rounded-2xl shadow-xl p-10 flex flex-col items-center gap-6">
          <div className="text-6xl">🎉</div>
          <h1 className="text-4xl font-black text-brand-600">You Win!</h1>
          <p className="text-gray-500">
            The team successfully bridged{' '}
            <span className="font-bold text-gray-800 uppercase">{wordA}</span>
            {' '}to{' '}
            <span className="font-bold text-gray-800 uppercase">{wordB}</span>
          </p>

          {/* Winning path — each pill colored by the player who added it */}
          {path.length > 0 && (
            <div className="w-full">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Winning Path
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {path.map((nodeId, i) => {
                  const node = nodes?.[nodeId];
                  const color =
                    node?.isStart
                      ? '#0ea5e9'
                      : (playerColorMap[node?.createdBy ?? ''] ?? '#94a3b8');
                  return (
                    <span key={nodeId} className="flex items-center gap-2">
                      <span
                        className="px-3 py-1 rounded-full border-2 font-semibold text-sm uppercase"
                        style={{ borderColor: color, color, backgroundColor: `${color}18` }}
                      >
                        {node?.word ?? nodeId}
                      </span>
                      {i < path.length - 1 && (
                        <span className="text-gray-400">→</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Round scores */}
          {roundEntries.length > 0 && (
            <div className="w-full">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                This Round
              </p>
              <div className="flex flex-col gap-1">
                {roundEntries.map(([pid, pts]) => {
                  const color = playerColorMap[pid] ?? '#94a3b8';
                  const name = room.players?.[pid]?.name ?? pid;
                  return (
                    <div key={pid} className="flex items-center justify-between px-3 py-1 rounded-lg bg-gray-50">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-sm text-gray-700">{name}</span>
                      </span>
                      <span className="text-sm font-bold text-green-600">+{pts} pt{pts !== 1 ? 's' : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cumulative scores */}
          {totalEntries.length > 0 && (
            <div className="w-full">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Total Scores
              </p>
              <div className="flex flex-col gap-1">
                {totalEntries.map(([pid, pts], rank) => {
                  const color = playerColorMap[pid] ?? '#94a3b8';
                  const name = room.players?.[pid]?.name ?? pid;
                  return (
                    <div key={pid} className="flex items-center justify-between px-3 py-1 rounded-lg bg-gray-50">
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-4">{rank + 1}.</span>
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-sm text-gray-700">{name}</span>
                      </span>
                      <span className="text-sm font-bold text-gray-800">{pts}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-3 w-full mt-2">
            {isHost ? (
              <button
                onClick={handlePlayAgain}
                disabled={restarting}
                className="w-full py-3 rounded-xl bg-brand-500 text-white font-bold text-lg hover:bg-brand-600 disabled:opacity-60 transition-colors"
              >
                {restarting ? 'Starting new game…' : 'Play Again'}
              </button>
            ) : (
              <p className="text-gray-500 text-sm">
                Waiting for the host to start a new game…
              </p>
            )}
            <button
              onClick={() => navigate('/')}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Leave room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
