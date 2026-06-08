import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { useRoomSubscription } from '../hooks/useRoomSubscription';

export default function VictoryPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const room = useGameStore((s) => s.room);

  useRoomSubscription(roomId);

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

  // Resolve winning path to words
  const pathWords: string[] = (winningPath ?? []).map(
    (id) => nodes?.[id]?.word ?? id,
  );

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

          {pathWords.length > 0 && (
            <div className="w-full">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Winning Path
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {pathWords.map((word, i) => (
                  <span key={i} className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-brand-50 border border-brand-500 text-brand-700 font-semibold text-sm uppercase">
                      {word}
                    </span>
                    {i < pathWords.length - 1 && (
                      <span className="text-gray-400">→</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => navigate('/')}
            className="mt-2 px-8 py-3 rounded-xl bg-brand-500 text-white font-bold hover:bg-brand-600 transition-colors"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
