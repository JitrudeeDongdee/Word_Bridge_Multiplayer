import { useParams } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { useRoomSubscription } from '../hooks/useRoomSubscription';
import { useWinDetection } from '../hooks/useWinDetection';
import GameCanvas from '../components/GameCanvas';
import AddWordPanel from '../components/AddWordPanel';
import PlayerList from '../components/PlayerList';

export default function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);

  useRoomSubscription(roomId);
  useWinDetection(roomId ?? '');

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
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <main className="flex-1 relative">
          <GameCanvas room={room} roomId={roomId} playerId={playerId} />
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
            <PlayerList players={room.players ?? {}} currentPlayerId={playerId} />
          </div>
          <div className="mt-auto">
            <p className="text-xs text-gray-400">
              Drag nodes to rearrange. Connect two nodes by dragging from one handle to another.
              You can only delete your own nodes.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
