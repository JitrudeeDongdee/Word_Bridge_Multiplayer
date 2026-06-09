import { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import WordNode from './WordNode';
import type { Room } from '../types';
import { useGameActions } from '../hooks/useGameActions';

const nodeTypes = { wordNode: WordNode };

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
}

export default function GameCanvas({ room, roomId, playerId, playerColorMap }: GameCanvasProps) {
  const { handleDeleteNode, handleNodeDragStop } = useGameActions(roomId);

  // Build React Flow nodes from Firebase state
  const rfNodes: Node[] = useMemo(
    () =>
      Object.values(room.nodes ?? {}).map((n) => ({
        id: n.id,
        type: 'wordNode',
        position: { x: n.x, y: n.y },
        data: {
          word: n.word,
          isStart: n.isStart,
          canDelete: n.createdBy === playerId && !n.isStart,
          onDelete: handleDeleteNode,
          playerColor: n.isStart ? undefined : (playerColorMap[n.createdBy] ?? '#94a3b8'),
        },
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room.nodes, playerId, playerColorMap],
  );

  // Build React Flow edges from Firebase state
  const rfEdges: Edge[] = useMemo(() => {
    const nodeMap = new Map(rfNodes.map((n) => [n.id, n.position]));
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

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle,
        targetHandle,
        type: 'default',
        animated: false,
      };
    });
  }, [room.edges, rfNodes]);

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
        <MiniMap nodeColor={(n) => (n.data.isStart ? '#0ea5e9' : ((n.data.playerColor as string) ?? '#e2e8f0'))} />
      </ReactFlow>
    </div>
  );
}
