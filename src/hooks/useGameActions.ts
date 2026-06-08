import { useCallback } from 'react';
import type { Connection } from '@xyflow/react';
import {
  addNode,
  addEdge,
  deleteNode,
  deleteEdgesForNode,
  updateNodePosition,
} from '../services/roomService';
import { useGameStore } from '../store/useGameStore';
import { validateWord } from '../utils/validation';

export function useGameActions(roomId: string) {
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);

  const handleAddWord = useCallback(
    async (word: string): Promise<string | null> => {
      if (!room || !playerId) return 'Not connected to a room.';

      const nodes = Object.values(room.nodes ?? {});
      const result = validateWord(word, nodes);
      if (!result.valid) return result.error ?? 'Invalid word.';

      await addNode(roomId, word, playerId);
      return null;
    },
    [room, playerId, roomId],
  );

  const handleConnect = useCallback(
    async (connection: Connection): Promise<void> => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;

      // Prevent duplicate edges
      const edges = Object.values(room?.edges ?? {});
      const exists = edges.some(
        (e) =>
          (e.source === connection.source && e.target === connection.target) ||
          (e.source === connection.target && e.target === connection.source),
      );
      if (exists) return;

      await addEdge(roomId, connection.source, connection.target);
    },
    [room, roomId],
  );

  const handleDeleteNode = useCallback(
    async (nodeId: string): Promise<void> => {
      if (!playerId) return;
      const node = room?.nodes?.[nodeId];
      if (!node) return;
      if (node.isStart) return;
      if (node.createdBy !== playerId) return;

      await deleteEdgesForNode(roomId, nodeId);
      await deleteNode(roomId, nodeId);
    },
    [room, playerId, roomId],
  );

  const handleNodeDragStop = useCallback(
    async (nodeId: string, x: number, y: number): Promise<void> => {
      await updateNodePosition(roomId, nodeId, x, y);
    },
    [roomId],
  );

  return { handleAddWord, handleConnect, handleDeleteNode, handleNodeDragStop };
}
