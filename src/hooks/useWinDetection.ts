import { useEffect } from 'react';
import { checkWin, findPath } from '../utils/graph';
import { markRoomWon } from '../services/roomService';
import { useGameStore } from '../store/useGameStore';

/**
 * Watches room edges and triggers win detection after every update.
 * Only the host executes the write to avoid duplicate Firebase writes.
 */
export function useWinDetection(roomId: string): void {
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);

  useEffect(() => {
    if (!room || room.status !== 'playing' || !room.gameState) return;
    if (!playerId || room.hostId !== playerId) return;

    const { wordANodeId, wordBNodeId } = room.gameState;
    const edges = Object.values(room.edges ?? {});

    if (checkWin(wordANodeId, wordBNodeId, edges)) {
      const path = findPath(wordANodeId, wordBNodeId, edges) ?? [];

      // 1 point per non-start node in the path for the player who added it
      const roundScores: Record<string, number> = {};
      for (const nodeId of path) {
        const node = room.nodes?.[nodeId];
        if (node && !node.isStart) {
          roundScores[node.createdBy] = (roundScores[node.createdBy] ?? 0) + 1;
        }
      }

      // Bonus: +5 points if the bridge was completed with just 1 intermediate word
      const nonStartInPath = path.filter((nid) => !room.nodes?.[nid]?.isStart);
      if (nonStartInPath.length === 1) {
        const bonusNode = room.nodes?.[nonStartInPath[0]];
        if (bonusNode) {
          roundScores[bonusNode.createdBy] = (roundScores[bonusNode.createdBy] ?? 0) + 5;
        }
      }

      markRoomWon(roomId, playerId, path, roundScores).catch(console.error);
    }
  }, [room, playerId, roomId]);
}
