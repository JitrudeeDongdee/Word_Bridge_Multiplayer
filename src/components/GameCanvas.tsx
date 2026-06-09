import { useState, useCallback, useMemo, useEffect, type MutableRefObject } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  useReactFlow,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodeDrag,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import WordNode from './WordNode';
import type { Room } from '../types';
import { useGameActions } from '../hooks/useGameActions';

const nodeTypes = { wordNode: WordNode };

/** Inner component to capture fitView — must live inside the ReactFlow context */
function FitViewCapture({ fitViewRef }: { fitViewRef?: MutableRefObject<(() => void) | null> }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (fitViewRef) fitViewRef.current = () => fitView({ padding: 0.2 });
  }, [fitView, fitViewRef]);
  return null;
}

const NODE_GAP = 8; // minimum gap between nodes in pixels

function nodesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    a.x < b.x + b.w + NODE_GAP &&
    a.x + a.w + NODE_GAP > b.x &&
    a.y < b.y + b.h + NODE_GAP &&
    a.y + a.h + NODE_GAP > b.y
  );
}

interface GameCanvasProps {
  room: Room;
  roomId: string;
  playerId: string;
  playerColorMap: Record<string, string>;
  fitViewRef?: MutableRefObject<(() => void) | null>;
}

export default function GameCanvas({ room, roomId, playerId, playerColorMap, fitViewRef }: GameCanvasProps) {
  const { handleDeleteNode, handleNodeDragStop } = useGameActions(roomId);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Adjacency: nodeId → connected words list (for tooltip)
  const adjacencyWords = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of Object.values(room.edges ?? {})) {
      const srcWord = room.nodes?.[edge.source]?.word;
      const tgtWord = room.nodes?.[edge.target]?.word;
      if (tgtWord) { if (!map.has(edge.source)) map.set(edge.source, []); map.get(edge.source)!.push(tgtWord); }
      if (srcWord) { if (!map.has(edge.target)) map.set(edge.target, []); map.get(edge.target)!.push(srcWord); }
    }
    return map;
  }, [room.edges, room.nodes]);

  // Set of node IDs connected to the hovered node
  const highlightedIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    const set = new Set<string>();
    for (const edge of Object.values(room.edges ?? {})) {
      if (edge.source === hoveredNodeId) set.add(edge.target);
      if (edge.target === hoveredNodeId) set.add(edge.source);
    }
    return set;
  }, [hoveredNodeId, room.edges]);

  // Build React Flow nodes from Firebase state
  const rfNodes: Node[] = useMemo(() => {
    const pathIds = new Set(
      room.status === 'won' ? (room.winningPath ?? []) : [],
    );
    return Object.values(room.nodes ?? {}).map((n) => ({
      id: n.id,
      type: 'wordNode',
      position: { x: n.x, y: n.y },
      data: {
        word: n.word,
        isStart: n.isStart,
        canDelete: n.createdBy === playerId && !n.isStart,
        onDelete: handleDeleteNode,
        playerColor: n.isStart ? undefined : (playerColorMap[n.createdBy] ?? '#94a3b8'),
        isPathNode: pathIds.has(n.id),
        connectedWords: adjacencyWords.get(n.id) ?? [],
        isHighlighted: highlightedIds.has(n.id),
        isNew: !!n.isNew,
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.nodes, room.winningPath, room.status, playerId, playerColorMap, adjacencyWords, highlightedIds]);

  // Build React Flow edges from Firebase state
  const rfEdges: Edge[] = useMemo(() => {
    const nodeMap = new Map(rfNodes.map((n) => [n.id, n.position]));

    // Build a map of edgeId → highlight color for winning-path edges
    const pathEdgeColors = new Map<string, string>();
    if (room.status === 'won' && room.winningPath && room.winningPath.length >= 2) {
      const pairColor = new Map<string, string>();
      for (let i = 0; i < room.winningPath.length - 1; i++) {
        const aId = room.winningPath[i];
        const bId = room.winningPath[i + 1];
        const bNode = room.nodes?.[bId];
        const aNode = room.nodes?.[aId];
        const colorNode =
          bNode && !bNode.isStart ? bNode
          : aNode && !aNode.isStart ? aNode
          : null;
        const color = colorNode
          ? (playerColorMap[colorNode.createdBy] ?? '#0ea5e9')
          : '#0ea5e9';
        pairColor.set([aId, bId].sort().join('|'), color);
      }
      for (const e of Object.values(room.edges ?? {})) {
        const key = [e.source, e.target].sort().join('|');
        const color = pairColor.get(key);
        if (color) pathEdgeColors.set(e.id, color);
      }
    }

    return Object.values(room.edges ?? {}).map((e) => {
      const srcPos = nodeMap.get(e.source);
      const tgtPos = nodeMap.get(e.target);

      let sourceHandle = 's-right';
      let targetHandle = 't-left';

      if (srcPos && tgtPos) {
        const dx = tgtPos.x - srcPos.x;
        const dy = tgtPos.y - srcPos.y;
        if (Math.abs(dx) >= Math.abs(dy)) {
          sourceHandle = dx >= 0 ? 's-right' : 's-left';
          targetHandle = dx >= 0 ? 't-left'  : 't-right';
        } else {
          sourceHandle = dy >= 0 ? 's-bottom' : 's-top';
          targetHandle = dy >= 0 ? 't-top'    : 't-bottom';
        }
      }

      const pathColor = pathEdgeColors.get(e.id);
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle,
        targetHandle,
        type: 'default',
        animated: pathColor !== undefined,
        style: pathColor ? { stroke: pathColor, strokeWidth: 3 } : undefined,
      };
    });
  }, [room.edges, room.winningPath, room.status, room.nodes, rfNodes, playerColorMap]);

  const [localNodes, setLocalNodes] = useState<Node[]>(rfNodes);
  const [localEdges, setLocalEdges] = useState<Edge[]>(rfEdges);

  // Keep local state in sync when Firebase state updates
  const syncedNodes = rfNodes;
  const syncedEdges = rfEdges;

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setLocalNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setLocalEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onNodeDragStop = useCallback<OnNodeDrag>(
    (_event, node) => {
      const dw = (node.measured?.width ?? 150);
      const dh = (node.measured?.height ?? 44);
      const dragged = { x: node.position.x, y: node.position.y, w: dw, h: dh };

      const hasOverlap = syncedNodes.some((other) => {
        if (other.id === node.id) return false;
        return nodesOverlap(dragged, {
          x: other.position.x,
          y: other.position.y,
          w: (other.measured?.width ?? 150),
          h: (other.measured?.height ?? 44),
        });
      });

      if (!hasOverlap) {
        handleNodeDragStop(node.id, node.position.x, node.position.y);
      }
      // If overlapping, skip Firebase update → node reverts to original position
    },
    [handleNodeDragStop, syncedNodes],
  );

  const onNodeMouseEnter = useCallback<NodeMouseHandler>((_e, node) => {
    setHoveredNodeId(node.id);
  }, []);

  const onNodeMouseLeave = useCallback<NodeMouseHandler>(() => {
    setHoveredNodeId(null);
  }, []);

  // Use Firebase-derived nodes/edges as the source of truth (controlled mode)
  void localNodes;
  void localEdges;

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={syncedNodes}
        edges={syncedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        connectOnClick={false}
        nodesConnectable={false}
        connectionMode={ConnectionMode.Loose}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode={null}
      >
        <Background />
        <Controls />
        <MiniMap className="hidden md:block" nodeColor={(n) => (n.data.isStart ? '#0ea5e9' : ((n.data.playerColor as string) ?? '#e2e8f0'))} />
        <FitViewCapture fitViewRef={fitViewRef} />
      </ReactFlow>
    </div>
  );
}
