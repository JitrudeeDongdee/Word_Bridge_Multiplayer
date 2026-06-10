import { useCallback } from 'react';
import {
  addNode,
  addEdge,
  fetchNodes,
  fetchEdges,
  saveWordScores,
  updateNodeScores,
  deleteNode,
  deleteEdgesForNode,
  updateNodePosition,
  batchUpdateNodePositions,
} from '../services/roomService';
import { forceDirectedLayout } from '../utils/graphLayout';
import { useGameStore } from '../store/useGameStore';
import { validateWord, checkRealWord } from '../utils/validation';
import { semanticSimilarity } from '../utils/semanticSimilarity';

const AUTO_BRIDGE_THRESHOLD = 0.15;

export interface WordScoreEntry {
  word: string;
  score: number;
  connected: boolean;
}

export interface AddWordResult {
  error: string | null;
  scores: WordScoreEntry[];
}

export function useGameActions(roomId: string) {
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);

  const handleAddWord = useCallback(
    async (word: string): Promise<AddWordResult> => {
      const fail = (error: string): AddWordResult => ({ error, scores: [] });

      if (!room || !playerId) return fail('Not connected to a room.');

      const nodes = Object.values(room.nodes ?? {});
      const result = validateWord(word, nodes);
      if (!result.valid) return fail(result.error ?? 'Invalid word.');

      const wordCheck = await checkRealWord(word.trim());
      if (wordCheck === 'not_found')
        return fail(`"${word.trim()}" wasn't found in the dictionary. Only common English words are allowed — proper nouns like place or person names are not supported.`);
      if (wordCheck === 'network_error')
        return fail('Could not verify the word. Please check your connection and try again.');

      const newNodeId = await addNode(roomId, word, playerId);

      // Read fresh node/edge data from Firebase to avoid stale Zustand state
      const [freshNodes, freshEdges] = await Promise.all([
        fetchNodes(roomId),
        fetchEdges(roomId),
      ]);

      const existingNodes = Object.values(freshNodes).filter((n) => n.id !== newNodeId);
      if (existingNodes.length === 0) return { error: null, scores: [] };

      // Build existing edge set for duplicate prevention
      const edgeSet = new Set(
        Object.values(freshEdges).flatMap((e) => [
          `${e.source}|${e.target}`,
          `${e.target}|${e.source}`,
        ]),
      );
      const hasEdge = (a: string, b: string) =>
        edgeSet.has(`${a}|${b}`);

      const newWord = word.trim().toLowerCase();

      // 1. Score the new word against every existing node
      const similarities = await Promise.all(
        existingNodes.map(async (node) => ({
          node,
          sim: await semanticSimilarity(newWord, node.word.toLowerCase()),
        })),
      );

      const toConnect = similarities.filter((s) => s.sim >= AUTO_BRIDGE_THRESHOLD);
      await Promise.all(
        toConnect
          .filter((s) => !hasEdge(newNodeId, s.node.id))
          .map((s) => addEdge(roomId, newNodeId, s.node.id)),
      );

      // 2. Also bridge existing node-pairs that have no edge yet
      //    (catches words added simultaneously or missed due to stale state)
      const { wordANodeId, wordBNodeId } = room.gameState!;
      const pairChecks: Promise<void>[] = [];
      for (let i = 0; i < existingNodes.length; i++) {
        for (let j = i + 1; j < existingNodes.length; j++) {
          const a = existingNodes[i];
          const b = existingNodes[j];
          if (hasEdge(a.id, b.id)) continue;
          // Never create a direct edge between the two goal nodes — win must go through intermediates
          if (
            (a.id === wordANodeId && b.id === wordBNodeId) ||
            (a.id === wordBNodeId && b.id === wordANodeId)
          ) continue;
          pairChecks.push(
            semanticSimilarity(a.word.toLowerCase(), b.word.toLowerCase()).then(
              (sim) => {
                if (sim >= AUTO_BRIDGE_THRESHOLD) {
                  return addEdge(roomId, a.id, b.id);
                }
              },
            ),
          );
        }
      }
      await Promise.all(pairChecks);

      // Auto-layout: re-run after every word addition so connected nodes
      // cluster together and edges stay short / don't criss-cross.
      // Re-fetch nodes here (not freshNodes) to avoid writing positions to
      // paths of nodes that were deleted while similarity checks were running —
      // which would recreate ghost nodes with incomplete Firebase data.
      if (toConnect.length > 0) {
        const [currentNodes, allEdges] = await Promise.all([
          fetchNodes(roomId),
          fetchEdges(roomId),
        ]);
        const layoutResult = forceDirectedLayout(
          Object.values(currentNodes).map((n) => ({ id: n.id, x: n.x, y: n.y, fixed: n.isStart })),
          Object.values(allEdges),
        );
        await batchUpdateNodePositions(roomId, layoutResult);
      }

      const connectedIds = new Set(toConnect.map((s) => s.node.id));
      const scores: WordScoreEntry[] = similarities
        .map((s) => ({
          word: s.node.word,
          score: s.sim,
          connected: connectedIds.has(s.node.id),
        }))
        .sort((a, b) => b.score - a.score);

      // Persist scores to Firebase: shared last-word table + permanently on the node
      await Promise.all([
        saveWordScores(roomId, newWord, scores),
        updateNodeScores(roomId, newNodeId, scores),
      ]);

      return { error: null, scores };
    },
    [room, playerId, roomId],
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

  return { handleAddWord, handleDeleteNode, handleNodeDragStop };
}
