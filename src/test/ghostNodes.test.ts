import { describe, it, expect } from 'vitest';
import { dropGhostNodes } from '../utils/ghostNodes';
import type { Room } from '../types';

const node = (id: string, word: string) => ({ id, word, x: 0, y: 0, createdBy: 'p' });

describe('dropGhostNodes', () => {
  it('removes nodes without a word (and edges touching them)', () => {
    const room = {
      nodes: { a: node('a', 'element'), b: node('b', 'void'), g: { x: 775, y: 478 } },
      edges: { e1: { id: 'e1', source: 'a', target: 'b' }, e2: { id: 'e2', source: 'g', target: 'a' } },
    } as unknown as Room;
    const { room: clean, ghostIds } = dropGhostNodes(room);
    expect(ghostIds).toEqual(['g']);
    expect(Object.keys(clean.nodes ?? {})).toEqual(['a', 'b']);
    expect(Object.keys(clean.edges ?? {})).toEqual(['e1']);
  });

  it('leaves a healthy room untouched', () => {
    const room = { nodes: { a: node('a', 'element') } } as unknown as Room;
    const res = dropGhostNodes(room);
    expect(res.ghostIds).toEqual([]);
    expect(res.room).toBe(room);
  });

  it('copes with a room that has no nodes', () => {
    expect(dropGhostNodes({} as Room).ghostIds).toEqual([]);
  });
});
