import { useEffect } from 'react';
import { checkWin, findPath } from '../utils/graph';
import { markRoomWon } from '../services/roomService';
import { computeRoundScores } from '../utils/scoring';
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
      // findPath picks one shortest path to show; scoring covers all of them
      const path = findPath(wordANodeId, wordBNodeId, edges) ?? [];
      const result = computeRoundScores(room.nodes ?? {}, edges, wordANodeId, wordBNodeId);
      if (!result) return;
      markRoomWon(roomId, playerId, path, result.roundScores, result.breakdown).catch(console.error);
    }
  }, [room, playerId, roomId]);
}
