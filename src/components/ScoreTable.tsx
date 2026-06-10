import type { GameNode, GameEdge } from '../types';

interface EdgePair {
  key: string;
  sourceId: string;
  targetId: string;
  wordA: string;
  wordB: string;
  score: number | null;
  isGoal: boolean;
}

interface ScoreTableProps {
  nodes: Record<string, GameNode>;
  edges: Record<string, GameEdge>;
  startWords?: string[];
  highlightNodeId?: string | null;
}

export default function ScoreTable({
  nodes,
  edges,
  startWords = [],
  highlightNodeId,
}: ScoreTableProps) {
  const goalSet = new Set(startWords.map((w) => w.toLowerCase()));

  const pairs: EdgePair[] = Object.values(edges)
    .map((edge) => {
      const nodeA = nodes[edge.source];
      const nodeB = nodes[edge.target];
      if (!nodeA || !nodeB) return null;

      const score =
        nodeA.scores?.find((s) => s.word.toLowerCase() === nodeB.word.toLowerCase())?.score ??
        nodeB.scores?.find((s) => s.word.toLowerCase() === nodeA.word.toLowerCase())?.score ??
        null;

      return {
        key: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
        wordA: nodeA.word,
        wordB: nodeB.word,
        score,
        isGoal: goalSet.has(nodeA.word.toLowerCase()) || goalSet.has(nodeB.word.toLowerCase()),
      };
    })
    .filter((p): p is EdgePair => p !== null);

  const filtered = highlightNodeId
    ? pairs.filter((p) => p.sourceId === highlightNodeId || p.targetId === highlightNodeId)
    : pairs;

  filtered.sort((a, b) => {
    if (a.isGoal !== b.isGoal) return a.isGoal ? -1 : 1;
    return (b.score ?? -1) - (a.score ?? -1);
  });

  const highlightWord = highlightNodeId ? nodes[highlightNodeId]?.word : null;

  if (filtered.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic">
        {highlightWord ? `No connections for "${highlightWord}" yet.` : 'No connections yet.'}
      </p>
    );
  }

  return (
    <div>
      {highlightWord && (
        <p className="text-xs text-gray-400 mb-2">
          Edges for:{' '}
          <span className="font-bold uppercase text-gray-600">{highlightWord}</span>
        </p>
      )}
      <div className="space-y-2">
        {filtered.map((p) => {
          // Always put the focused node's word on the left
          const left  = highlightNodeId && p.targetId === highlightNodeId ? p.wordB : p.wordA;
          const right = highlightNodeId && p.targetId === highlightNodeId ? p.wordA : p.wordB;

          const pct   = p.score !== null ? Math.min(p.score * 100, 100) : 0;
          const label = p.score === null ? '—'
            : p.score >= 0.001 ? `${(p.score * 100).toFixed(1)}%`
            : p.score > 0     ? '< 0.1%'
            : '—';

          const barColor  = p.isGoal ? 'bg-amber-400' : 'bg-green-400';
          const wordColor = p.isGoal ? 'text-amber-600' : 'text-green-600';
          const badge     = p.isGoal ? '★' : '✓';

          return (
            <div key={p.key}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className={`uppercase font-semibold flex items-center gap-1 ${wordColor}`}>
                  <span>{left.toUpperCase()}</span>
                  <span className="text-gray-300">—</span>
                  <span>{right.toUpperCase()}</span>
                  <span className="font-bold">{badge}</span>
                </span>
                <span className="tabular-nums text-gray-500">{label}</span>
              </div>
              {p.score !== null && (
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
