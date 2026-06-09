import { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
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
  const rfEdges: Edge[] = useMemo(
    () =>
      Object.values(room.edges ?? {}).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: false,
      })),
    [room.edges],
  );

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
      handleNodeDragStop(node.id, node.position.x, node.position.y);
    },
    [handleNodeDragStop],
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
