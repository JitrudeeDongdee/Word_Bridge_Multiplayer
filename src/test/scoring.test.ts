import { describe, it, expect } from 'vitest';
import { computeRoundScores, potForLength } from '../utils/scoring';
import type { GameEdge, GameNode } from '../types';

// Build a room: words map id → [word, owner, scores-vs-other-words]
type Word = [string, string, Record<string, number>?];
function room(
  words: Record<string, Word>,
  links: Array<[string, string, Partial<GameEdge>?]>,
) {
  const nodes: Record<string, GameNode> = {};
  for (const [id, [word, owner, scores]] of Object.entries(words)) {
    nodes[id] = {
      id, word, x: 0, y: 0, createdBy: owner, isStart: owner === 'system',
      scores: Object.entries(scores ?? {}).map(([w, score]) => ({ word: w, score, connected: true })),
    };
  }
  const edges: GameEdge[] = links.map(([source, target, extra], i) => ({
    id: `e${i}`, source, target, ...extra,
  }));
  return { nodes, edges };
}

const A = 'A';
const B = 'B';
const start: Record<string, Word> = { [A]: ['bird', 'system'], [B]: ['baby', 'system'] };

describe('potForLength', () => {
  it('shrinks as the bridge gets longer', () => {
    expect([1, 2, 3, 4, 5, 9].map(potForLength)).toEqual([10, 8, 6, 4, 2, 2]);
  });
});

describe('computeRoundScores', () => {
  it('returns null when the goal words are not connected', () => {
    const { nodes, edges } = room({ ...start, n: ['nest', 'p1'] }, [[A, 'n']]);
    expect(computeRoundScores(nodes, edges, A, B)).toBeNull();
  });

  it('gives the whole pot to a single bridge word', () => {
    const { nodes, edges } = room({ ...start, e: ['egg', 'p1'] }, [[A, 'e'], ['e', B]]);
    const r = computeRoundScores(nodes, edges, A, B)!;
    expect(r.roundScores).toEqual({ p1: 10 });
    expect(r.breakdown).toMatchObject({ intermediates: 1, pot: 10, perWord: 10 });
  });

  it('pays shorter bridges more in total (no reward for padding)', () => {
    const totals = [1, 2, 3, 4, 5].map((k) => {
      const words: Record<string, Word> = { ...start };
      const ids = Array.from({ length: k }, (_, i) => `w${i}`);
      ids.forEach((id, i) => (words[id] = [`word${i}`, `p${i}`]));
      const chain = [A, ...ids, B];
      const { nodes, edges } = room(words, chain.slice(1).map((id, i) => [chain[i], id]));
      return Object.values(computeRoundScores(nodes, edges, A, B)!.roundScores).reduce((x, y) => x + y, 0);
    });
    expect(totals).toEqual([10, 8, 6, 4, 2]);
  });

  it('splits one pot across all equally short paths and ignores longer detours', () => {
    const { nodes, edges } = room(
      { ...start, n: ['nest', 'p1'], e: ['egg', 'p2'], t: ['tree', 'p3'], l: ['leaf', 'p3'] },
      [
        [A, 'n'], ['n', B], // shortest path 1
        [A, 'e'], ['e', B], // shortest path 2 (tie)
        [A, 't'], ['t', 'l'], ['l', B], // longer detour — not part of the bridge
      ],
    );
    const r = computeRoundScores(nodes, edges, A, B)!;
    expect(r.roundScores).toEqual({ p1: 5, p2: 5 });
    expect([...(r.breakdown.bridgeNodeIds ?? [])].sort()).toEqual(['e', 'n']);
  });

  it('rounds shared points to one decimal', () => {
    const { nodes, edges } = room(
      { ...start, x: ['x', 'p1'], y: ['y', 'p2'], z: ['z', 'p3'], w: ['w', 'p4'] },
      [[A, 'x'], ['x', 'y'], ['y', B], [A, 'z'], ['z', 'w'], ['w', B]], // two 2-word paths: 8 / 4
    );
    expect(computeRoundScores(nodes, edges, A, B)!.roundScores).toEqual({ p1: 2, p2: 2, p3: 2, p4: 2 });

    const three = room(
      { ...start, x: ['x', 'p1'], y: ['y', 'p1'], z: ['z', 'p2'] },
      [[A, 'x'], ['x', B], [A, 'y'], ['y', B], [A, 'z'], ['z', B]], // 10 / 3
    );
    expect(computeRoundScores(three.nodes, three.edges, A, B)!.roundScores).toEqual({ p1: 6.7, p2: 3.3 });
  });

  it('gives the finisher bonus to whoever created the newest bridge edge', () => {
    const { nodes, edges } = room(
      { ...start, n: ['nest', 'p1'], e: ['egg', 'p2'] },
      [
        [A, 'n', { createdBy: 'p1', createdAt: 100 }],
        ['n', 'e', { createdBy: 'p2', createdAt: 300 }], // completed the bridge
        ['e', B, { createdBy: 'p2', createdAt: 200 }],
      ],
    );
    const r = computeRoundScores(nodes, edges, A, B)!;
    expect(r.breakdown.finisherId).toBe('p2');
    expect(r.roundScores).toEqual({ p1: 4, p2: 6 });
  });

  it('skips the finisher bonus for edges without metadata (older rooms)', () => {
    const { nodes, edges } = room({ ...start, e: ['egg', 'p1'] }, [[A, 'e'], ['e', B]]);
    expect(computeRoundScores(nodes, edges, A, B)!.breakdown.finisherId).toBeNull();
  });

  it('gives a creative bonus for a Datamuse-confirmed but non-obvious auto link', () => {
    const { nodes, edges } = room(
      { ...start, n: ['nest', 'p1'] },
      [
        [A, 'n', { via: 'auto', score: 0.9, datamuse: 0.9 }],
        ['n', B, { via: 'auto', score: 0.2, datamuse: 0.2 }], // creative
      ],
    );
    const r = computeRoundScores(nodes, edges, A, B)!;
    expect(r.breakdown.creativeNodeIds).toEqual(['n']);
    expect(r.roundScores).toEqual({ p1: 11 });
  });

  it('does not count embedding-only links as creative (that range is mostly noise)', () => {
    // puppet–dog style: linked by the model alone, Datamuse knows no relation
    const { nodes, edges } = room(
      { ...start, n: ['dog', 'p1'] },
      [[A, 'n', { via: 'auto', score: 0.2, datamuse: 0 }], ['n', B, { via: 'auto', score: 0.18, datamuse: 0 }]],
    );
    expect(computeRoundScores(nodes, edges, A, B)!.breakdown.creativeNodeIds).toEqual([]);
  });

  it('does not count obvious links, vote links or edges without a Datamuse score', () => {
    const obvious = room(
      { ...start, n: ['nest', 'p1'] },
      [[A, 'n', { score: 0.9, datamuse: 0.9 }], ['n', B, { score: 0.5, datamuse: 0.5 }]],
    );
    expect(computeRoundScores(obvious.nodes, obvious.edges, A, B)!.breakdown.creativeNodeIds).toEqual([]);

    const voted = room(
      { ...start, n: ['nest', 'p1'] },
      [[A, 'n'], ['n', B, { via: 'vote', score: 0.2, datamuse: 0.2 }]],
    );
    expect(computeRoundScores(voted.nodes, voted.edges, A, B)!.breakdown.creativeNodeIds).toEqual([]);

    // Older rooms: score only on the nodes / edge, no Datamuse part recorded
    const legacy = room(
      { ...start, n: ['nest', 'p1', { bird: 0.9, baby: 0.2 }] },
      [[A, 'n', { score: 0.9 }], ['n', B, { score: 0.2 }]],
    );
    expect(computeRoundScores(legacy.nodes, legacy.edges, A, B)!.breakdown.creativeNodeIds).toEqual([]);
  });
});
