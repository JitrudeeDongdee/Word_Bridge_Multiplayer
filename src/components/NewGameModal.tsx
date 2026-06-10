import { useState } from 'react';
import type { Room } from '../types';
import { restartGame } from '../services/roomService';

interface NewGameModalProps {
  room: Room;
  roomId: string;
  playerId: string;
  playerColorMap: Record<string, string>;
  onClose: () => void;
}

export default function NewGameModal({
  room,
  roomId,
  playerId,
  playerColorMap,
  onClose,
}: NewGameModalProps) {
  const [restarting, setRestarting] = useState(false);

  const isHost = room.hostId === playerId;
  const { wordA, wordB } = room.gameState ?? { wordA: '?', wordB: '?' };
  const nodeCount = Object.keys(room.nodes ?? {}).length;
  const totalEntries = Object.entries(room.scores ?? {}).sort(([, a], [, b]) => b - a);

  const handleConfirm = async () => {
    if (!isHost) return;
    setRestarting(true);
    try {
      await restartGame(roomId);
      onClose();
    } catch {
      setRestarting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        title="Click to cancel"
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-3 flex-shrink-0">
          <div>
            <p className="text-2xl font-black text-gray-800">↺ New Game?</p>
            <p className="text-sm text-gray-500 mt-1">
              The current board will be cleared.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-xl leading-none flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 flex flex-col gap-4">
          {/* Current game info */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="font-bold uppercase text-brand-500 text-sm">{wordA}</span>
            <span className="text-gray-400 text-xs">→</span>
            <span className="font-bold uppercase text-brand-500 text-sm">{wordB}</span>
            <span className="ml-auto text-xs text-gray-400">{nodeCount} nodes</span>
          </div>

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
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
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

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={restarting}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 font-semibold text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={restarting || !isHost}
            className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white font-bold text-sm hover:bg-brand-600 disabled:opacity-60 transition-colors"
          >
            {restarting ? 'Starting…' : '↺ New Game'}
          </button>
        </div>
      </div>
    </div>
  );
}
