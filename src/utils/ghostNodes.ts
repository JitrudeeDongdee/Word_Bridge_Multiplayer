import type { Room } from '../types';

/**
 * A node with no word is a fragment, not a word: a position write that landed after the
 * node was deleted (e.g. a rejected word removed while it was being dragged) recreates
 * `{ x, y }` at its path. Code that reads `node.word` would crash on it, which froze
 * adding words for the whole room. Returns the room without them plus their ids.
 */
export function dropGhostNodes(room: Room): { room: Room; ghostIds: string[] } {
  const nodes = room.nodes;
  if (!nodes) return { room, ghostIds: [] };
  const ghostIds = Object.entries(nodes)
    .filter(([, n]) => typeof n?.word !== 'string' || n.word.trim() === '')
    .map(([id]) => id);
  if (ghostIds.length === 0) return { room, ghostIds };
  const kept = Object.fromEntries(Object.entries(nodes).filter(([id]) => !ghostIds.includes(id)));
  const edges = room.edges
    ? Object.fromEntries(Object.entries(room.edges).filter(([, e]) => !ghostIds.includes(e.source) && !ghostIds.includes(e.target)))
    : room.edges;
  return { room: { ...room, nodes: kept, edges }, ghostIds };
}
