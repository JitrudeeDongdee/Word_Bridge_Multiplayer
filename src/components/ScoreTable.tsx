import type { LastWordScores } from '../types';

interface ScoreTableProps {
  lastWordScores: LastWordScores | null;
}

export default function ScoreTable({ lastWordScores }: ScoreTableProps) {
  if (!lastWordScores || lastWordScores.scores.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic">No scores yet.</p>
    );
  }

  const { addedWord, scores } = lastWordScores;

  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">
        Last word:{' '}
        <span className="font-bold uppercase text-gray-600">{addedWord}</span>
      </p>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-gray-400 uppercase tracking-wide">
            <th className="text-left pb-1 font-medium">Word</th>
            <th className="text-right pb-1 font-medium">Score</th>
            <th className="text-right pb-1 font-medium">Link</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((s) => (
            <tr key={s.word} className="border-t border-gray-100">
              <td className="py-1 uppercase font-semibold text-gray-700">{s.word}</td>
              <td className="py-1 text-right tabular-nums text-gray-500">
                {(s.score * 100).toFixed(0)}
              </td>
              <td className="py-1 text-right">
                {s.connected ? (
                  <span className="text-green-500 font-bold">✓</span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
