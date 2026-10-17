import type { GameEdge, GameNode, RoundBreakdown } from '../types';

/** Points shared by the bridge words, by number of intermediate words (index = count). */
const POT_BY_LENGTH = [0, 10, 8, 6, 4];
/** Pot for bridges of 5+ intermediate words. */
const MIN_POT = 2;
/** Bonus for the player whose action completed the bridge. */
export const FINISHER_BONUS = 2;
/** Bonus per bridge word whose link is valid but not obvious. */
export const CREATIVE_BONUS = 1;
/** Link scores in [MIN, MAX) count as creative: above the auto-bridge threshold, below "obvious". */
export const CREATIVE_SCORE_MIN = 0.15;
export const CREATIVE_SCORE_MAX = 0.3;

export function potForLength(intermediates: number): number {
  if (intermediates <= 0) return 0;
  return POT_BY_LENGTH[intermediates] ?? MIN_POT;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function bfsDistances(from: string, adjacency: Map<string, string[]>): Map<string, number> {
  const dist = new Map<string, number>([[from, 0]]);
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (!dist.has(next)) {
        dist.set(next, dist.get(current)! + 1);
        queue.push(next);
      }
    }
  }
  return dist;
}

/**
 * Similarity score of a link: stored on the edge when it was created, falling back to the
 * scores saved on the nodes (edges from before scoring v2). The node scores are written only
 * after all edges, so they can be missing for the word that just completed the bridge.
 */
function linkScore(edge: GameEdge, a: GameNode | undefined, b: GameNode | undefined): number | null {
  if (edge.score !== undefined) return edge.score;
  if (!a || !b) return null;
  return (
    a.scores?.find((s) => s.word.toLowerCase() === b.word.toLowerCase())?.score ??
    b.scores?.find((s) => s.word.toLowerCase() === a.word.toLowerCase())?.score ??
    null
  );
}

export interface RoundResult {
  roundScores: Record<string, number>;
  breakdown: RoundBreakdown;
}

/**
 * Scores a won round (competitive):
 * - The bridge = every word on any shortest path from A to B. Shorter bridges make a
 *   bigger pot, split equally between those words' owners (ties share one pot).
 * - +FINISHER_BONUS to whoever created the newest edge on the bridge.
 * - +CREATIVE_BONUS per bridge word with an auto-bridged link scoring in the creative range.
 * Returns null when A and B aren't connected.
 */
export function computeRoundScores(
  nodes: Record<string, GameNode>,
  edges: GameEdge[],
  wordANodeId: string,
  wordBNodeId: string,
): RoundResult | null {
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    if (!adjacency.has(e.target)) adjacency.set(e.target, []);
    adjacency.get(e.source)!.push(e.target);
    adjacency.get(e.target)!.push(e.source);
  }

  const fromA = bfsDistances(wordANodeId, adjacency);
  const fromB = bfsDistances(wordBNodeId, adjacency);
  const length = fromA.get(wordBNodeId);
  if (length === undefined) return null;

  // A node lies on some shortest path iff its distances to A and B add up to the path length
  const onBridge = (id: string) =>
    fromA.has(id) && fromB.has(id) && fromA.get(id)! + fromB.get(id)! === length;

  const bridgeNodeIds = [...fromA.keys()].filter(
    (id) => id !== wordANodeId && id !== wordBNodeId && onBridge(id),
  );
  const bridgeEdges = edges.filter(
    (e) =>
      onBridge(e.source) &&
      onBridge(e.target) &&
      Math.abs(fromA.get(e.source)! - fromA.get(e.target)!) === 1,
  );

  const intermediates = length - 1;
  const pot = potForLength(intermediates);
  const perWord = bridgeNodeIds.length > 0 ? pot / bridgeNodeIds.length : 0;

  const scores: Record<string, number> = {};
  const add = (pid: string, pts: number) => {
    scores[pid] = (scores[pid] ?? 0) + pts;
  };

  for (const id of bridgeNodeIds) {
    const owner = nodes[id]?.createdBy;
    if (owner) add(owner, perWord);
  }

  // Finisher: the newest edge on the bridge is the one that completed it
  const newest = bridgeEdges
    .filter((e) => e.createdAt !== undefined && e.createdBy)
    .sort((x, y) => y.createdAt! - x.createdAt!)[0];
  const finisherId = newest?.createdBy ?? null;
  if (finisherId) add(finisherId, FINISHER_BONUS);

  // Creative: a bridge word with a non-obvious auto-bridged link (vote links don't count)
  const creativeNodeIds = bridgeNodeIds.filter((id) =>
    bridgeEdges.some((e) => {
      if (e.via === 'vote' || (e.source !== id && e.target !== id)) return false;
      const score = linkScore(e, nodes[e.source], nodes[e.target]);
      return score !== null && score >= CREATIVE_SCORE_MIN && score < CREATIVE_SCORE_MAX;
    }),
  );
  for (const id of creativeNodeIds) {
    const owner = nodes[id]?.createdBy;
    if (owner) add(owner, CREATIVE_BONUS);
  }

  const roundScores = Object.fromEntries(
    Object.entries(scores).map(([pid, pts]) => [pid, round1(pts)]),
  );

  return {
    roundScores,
    breakdown: {
      intermediates,
      pot,
      perWord: round1(perWord),
      bridgeNodeIds,
      finisherId,
      finisherBonus: finisherId ? FINISHER_BONUS : 0,
      creativeNodeIds,
      creativeBonus: CREATIVE_BONUS,
    },
  };
}
