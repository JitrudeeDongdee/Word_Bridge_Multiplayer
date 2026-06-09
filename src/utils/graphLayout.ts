export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  fixed?: boolean;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

const REPULSION       = 12000;
const SPRING_STRENGTH = 0.04;
const IDEAL_LENGTH    = 190;
const DAMPING         = 0.80;
const MAX_SPEED       = 120;
const MIN_X = 80;  const MAX_X = 920;
const MIN_Y = 60;  const MAX_Y = 540;

/**
 * Force-directed layout (Fruchterman–Reingold style).
 * Fixed nodes (start words) stay in place; all others are repositioned
 * so that connected nodes cluster together and unconnected ones spread out.
 */
export function forceDirectedLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  iterations = 120,
): Record<string, { x: number; y: number }> {
  if (nodes.length <= 1) {
    return Object.fromEntries(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  }

  const pos = new Map<string, { x: number; y: number }>(
    nodes.map((n) => [n.id, { x: n.x, y: n.y }]),
  );
  const vel = new Map<string, { vx: number; vy: number }>(
    nodes.map((n) => [n.id, { vx: 0, vy: 0 }]),
  );
  const fixed = new Set(nodes.filter((n) => n.fixed).map((n) => n.id));

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;
    const forces = new Map<string, { fx: number; fy: number }>(
      nodes.map((n) => [n.id, { fx: 0, fy: 0 }]),
    );

    // Coulomb repulsion between every pair of nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const pi = pos.get(nodes[i].id)!;
        const pj = pos.get(nodes[j].id)!;
        const dx = pj.x - pi.x || 0.01;
        const dy = pj.y - pi.y || 0.01;
        const dist2 = Math.max(dx * dx + dy * dy, 1);
        const dist  = Math.sqrt(dist2);
        const mag   = REPULSION / dist2;
        const fx    = (mag * dx) / dist;
        const fy    = (mag * dy) / dist;
        forces.get(nodes[i].id)!.fx -= fx;
        forces.get(nodes[i].id)!.fy -= fy;
        forces.get(nodes[j].id)!.fx += fx;
        forces.get(nodes[j].id)!.fy += fy;
      }
    }

    // Hooke spring attraction along each edge
    for (const edge of edges) {
      const pa = pos.get(edge.source);
      const pb = pos.get(edge.target);
      if (!pa || !pb) continue;
      const dx      = pb.x - pa.x;
      const dy      = pb.y - pa.y;
      const dist    = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const stretch = dist - IDEAL_LENGTH;
      const mag     = SPRING_STRENGTH * stretch;
      const fx      = (mag * dx) / dist;
      const fy      = (mag * dy) / dist;
      forces.get(edge.source)!.fx += fx;
      forces.get(edge.source)!.fy += fy;
      forces.get(edge.target)!.fx -= fx;
      forces.get(edge.target)!.fy -= fy;
    }

    // Integrate velocities and clamp to canvas bounds
    for (const node of nodes) {
      if (fixed.has(node.id)) continue;
      const p     = pos.get(node.id)!;
      const f     = forces.get(node.id)!;
      const v     = vel.get(node.id)!;
      v.vx = (v.vx + f.fx * cooling) * DAMPING;
      v.vy = (v.vy + f.fy * cooling) * DAMPING;
      const speed = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
      const limit = MAX_SPEED * cooling + 1;
      if (speed > limit) {
        v.vx = (v.vx / speed) * limit;
        v.vy = (v.vy / speed) * limit;
      }
      p.x = Math.max(MIN_X, Math.min(MAX_X, p.x + v.vx));
      p.y = Math.max(MIN_Y, Math.min(MAX_Y, p.y + v.vy));
    }
  }

  return Object.fromEntries(
    Array.from(pos.entries()).map(([id, p]) => [id, { x: Math.round(p.x), y: Math.round(p.y) }]),
  );
}
