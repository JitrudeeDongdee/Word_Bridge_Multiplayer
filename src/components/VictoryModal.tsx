import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Room } from '../types';
import { restartGame } from '../services/roomService';

interface VictoryModalProps {
  room: Room;
  roomId: string;
  playerId: string;
  playerColorMap: Record<string, string>;
}

export default function VictoryModal({ room, roomId, playerId, playerColorMap }: VictoryModalProps) {
  const navigate = useNavigate();
  const [minimized, setMinimized] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const isHost = room.hostId === playerId;
  const { gameState, nodes, winningPath } = room;
  const wordA = gameState?.wordA ?? '?';
  const wordB = gameState?.wordB ?? '?';
  const path = winningPath ?? [];

  const roundEntries = Object.entries(room.roundScores ?? {}).sort(([, a], [, b]) => b - a);
  const totalEntries = Object.entries(room.scores ?? {}).sort(([, a], [, b]) => b - a);

  const handlePlayAgain = async () => {
    if (!isHost) return;
    setRestarting(true);
    try {
      await restartGame(roomId);
      // Component unmounts when status → 'playing'
    } catch {
      setRestarting(false);
    }
  };

  /* ── Minimised: floating pill at bottom-right ── */
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-white border-2 border-brand-400 rounded-2xl shadow-2xl text-brand-600 font-bold text-sm hover:bg-brand-50 transition-all"
      >
        🎉 View Results
      </button>
    );
  }

  /* ── Full modal ── */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Semi-transparent backdrop — lets the canvas show through */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => setMinimized(true)}
        title="Click to minimise"
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-3 flex-shrink-0">
          <div>
            <p className="text-3xl font-black text-brand-600">🎉 You Win!</p>
            <p className="text-sm text-gray-500 mt-1">
              <span className="font-bold uppercase text-gray-800">{wordA}</span>
              <span className="mx-1.5 text-gray-400">→</span>
              <span className="font-bold uppercase text-gray-800">{wordB}</span>
            </p>
          </div>
          <button
            onClick={() => setMinimized(true)}
            title="See the board"
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-xl leading-none flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 flex flex-col gap-5">
          {/* Winning path */}
          {path.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Winning Path
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {path.map((nodeId, i) => {
                  const node = nodes?.[nodeId];
                  const color = node?.isStart
                    ? '#0ea5e9'
                    : (playerColorMap[node?.createdBy ?? ''] ?? '#94a3b8');
                  return (
                    <span key={nodeId} className="flex items-center gap-1.5">
                      <span
                        className="px-2.5 py-0.5 rounded-full border-2 font-semibold text-xs uppercase"
                        style={{ borderColor: color, color, backgroundColor: `${color}18` }}
                      >
                        {node?.word ?? nodeId}
                      </span>
                      {i < path.length - 1 && (
                        <span className="text-gray-300 text-xs">→</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Round scores */}
          {roundEntries.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                This Round
              </p>
              <div className="flex flex-col gap-1">
                {roundEntries.map(([pid, pts]) => {
                  const color = playerColorMap[pid] ?? '#94a3b8';
                  const name = room.players?.[pid]?.name ?? pid;
                  return (
                    <div
                      key={pid}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-50"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-sm text-gray-700">{name}</span>
                      </span>
                      <span className="text-sm font-bold text-green-600">
                        +{pts} pt{pts !== 1 ? 's' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Total scores */}
          {totalEntries.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Total Scores
              </p>
              <div className="flex flex-col gap-1">
                {totalEntries.map(([pid, pts], rank) => {
                  const color = playerColorMap[pid] ?? '#94a3b8';
                  const name = room.players?.[pid]?.name ?? pid;
                  return (
                    <div
                      key={pid}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-50"
                    >
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
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          {isHost ? (
            <button
              onClick={handlePlayAgain}
              disabled={restarting}
              className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white font-bold text-sm hover:bg-brand-600 disabled:opacity-60 transition-colors"
            >
              {restarting ? 'Starting…' : 'Play Again'}
            </button>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400 py-2.5">
              Waiting for host to start…
            </div>
          )}
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Leave Room
          </button>
        </div>
      </div>
    </div>
  );
}
