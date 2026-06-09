import { useCallback } from 'react';
import {
  addNode,
  addEdge,
  fetchNodes,
  fetchEdges,
  saveWordScores,
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

      const isReal = await checkRealWord(word.trim());
      if (!isReal) return fail(`"${word.trim()}" is not a real English word.`);

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
      const pairChecks: Promise<void>[] = [];
      for (let i = 0; i < existingNodes.length; i++) {
        for (let j = i + 1; j < existingNodes.length; j++) {
          const a = existingNodes[i];
          const b = existingNodes[j];
          if (hasEdge(a.id, b.id)) continue;
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
      if (toConnect.length > 0) {
        const allEdges = await fetchEdges(roomId);
        const layoutResult = forceDirectedLayout(
          Object.values(freshNodes).map((n) => ({ id: n.id, x: n.x, y: n.y, fixed: n.isStart })),
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

      // Persist scores to Firebase so all players see the same table
      await saveWordScores(roomId, newWord, scores);

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
