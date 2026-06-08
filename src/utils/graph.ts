import type { GameEdge } from '../types';

/**
 * BFS-based win detection. Returns true if a path exists between
 * startNodeId and targetNodeId in the undirected edge graph.
 */
export function checkWin(
  startNodeId: string,
  targetNodeId: string,
  edges: GameEdge[],
): boolean {
  if (startNodeId === targetNodeId) return true;

  const adjacency = buildAdjacency(edges);
  const visited = new Set<string>();
  const queue: string[] = [startNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === targetNodeId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const neighbours = adjacency.get(current) ?? [];
    for (const neighbour of neighbours) {
      if (!visited.has(neighbour)) {
        queue.push(neighbour);
      }
    }
  }

  return false;
}

/**
 * BFS path reconstruction. Returns the ordered list of node IDs forming
 * the shortest path, or null if no path exists.
 */
export function findPath(
  startNodeId: string,
  targetNodeId: string,
  edges: GameEdge[],
): string[] | null {
  if (startNodeId === targetNodeId) return [startNodeId];

  const adjacency = buildAdjacency(edges);
  const visited = new Set<string>();
  const queue: Array<{ id: string; path: string[] }> = [
    { id: startNodeId, path: [startNodeId] },
  ];

  while (queue.length > 0) {
    const { id: current, path } = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const neighbours = adjacency.get(current) ?? [];
    for (const neighbour of neighbours) {
      const newPath = [...path, neighbour];
      if (neighbour === targetNodeId) return newPath;
      if (!visited.has(neighbour)) {
        queue.push({ id: neighbour, path: newPath });
      }
    }
  }

  return null;
}

function buildAdjacency(edges: GameEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const edge of edges) {
    if (!map.has(edge.source)) map.set(edge.source, []);
    if (!map.has(edge.target)) map.set(edge.target, []);
    map.get(edge.source)!.push(edge.target);
    map.get(edge.target)!.push(edge.source);
  }

  return map;
}
