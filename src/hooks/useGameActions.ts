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
import { semanticScores, AUTO_BRIDGE_THRESHOLD, type PairScore } from '../utils/semanticSimilarity';
import { castPairVote, pairKey, PAIR_VOTE_THRESHOLD } from '../services/pairVotesService';
import { useLearnedPairs } from './useLearnedPairs';

export interface WordScoreEntry {
  word: string;
  score: number;
  connected: boolean;
}

export interface AddWordResult {
  error: string | null;
  scores: WordScoreEntry[];
}

export interface VotePairResult {
  error: string | null;
  count: number;
  threshold: number;
  linked: boolean;
}

/** Re-runs the force layout so newly connected nodes cluster together. */
async function relayout(roomId: string): Promise<void> {
  // Re-fetch nodes here (not cached state) to avoid writing positions to
  // paths of nodes that were deleted in the meantime — which would recreate
  // ghost nodes with incomplete Firebase data.
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

export function useGameActions(roomId: string) {
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const learnedPairs = useLearnedPairs();

  // Pairs players voted in are always connected; everything else goes by similarity
  const scorePair = useCallback(
    async (a: string, b: string): Promise<PairScore> =>
      learnedPairs.has(pairKey(a, b))
        ? { score: 1, datamuse: 0, embedding: null }
        : semanticScores(a, b),
    [learnedPairs],
  );

  const handleAddWord = useCallback(
    async (word: string, signal?: AbortSignal): Promise<AddWordResult> => {
      const fail = (error: string): AddWordResult => ({ error, scores: [] });
      const aborted = () => signal?.aborted ?? false;

      if (!room || !playerId) return fail('Not connected to a room.');

      const nodes = Object.values(room.nodes ?? {});
      const result = validateWord(word, nodes, playerId);
      if (!result.valid) return fail(result.error ?? 'Invalid word.');

      const wordCheck = await checkRealWord(word.trim(), signal);
      if (aborted()) return { error: null, scores: [] };
      if (wordCheck === 'not_found')
        return fail(`"${word.trim()}" wasn't found in the dictionary. Only common English words are allowed — proper nouns like place or person names are not supported.`);
      if (wordCheck === 'network_error')
        return fail('Could not verify the word. Please check your connection and try again.');

      const newNodeId = await addNode(roomId, word, playerId);
      if (aborted()) { deleteNode(roomId, newNodeId).catch(() => {}); return { error: null, scores: [] }; }

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
          sim: await scorePair(newWord, node.word.toLowerCase()),
        })),
      );

      const toConnect = similarities.filter((s) => s.sim.score >= AUTO_BRIDGE_THRESHOLD);
      await Promise.all(
        toConnect
          .filter((s) => !hasEdge(newNodeId, s.node.id))
          .map((s) => addEdge(roomId, newNodeId, s.node.id, playerId, 'auto', s.sim)),
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
            scorePair(a.word.toLowerCase(), b.word.toLowerCase()).then(
              (sim) => {
                if (sim.score >= AUTO_BRIDGE_THRESHOLD) {
                  return addEdge(roomId, a.id, b.id, playerId, 'auto', sim);
                }
              },
            ),
          );
        }
      }
      await Promise.all(pairChecks);

      // Auto-layout: re-run after every word addition so connected nodes
      // cluster together and edges stay short / don't criss-cross.
      if (toConnect.length > 0) await relayout(roomId);

      const connectedIds = new Set(toConnect.map((s) => s.node.id));
      const scores: WordScoreEntry[] = similarities
        .map((s) => ({
          word: s.node.word,
          score: s.sim.score,
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
    [room, playerId, roomId, scorePair],
  );

  /**
   * Votes that two words on the canvas should be connected. When enough distinct
   * players have voted for the pair (across all rooms) it becomes a learned pair:
   * it is linked here right away and auto-bridged in every future game.
   */
  const handleVotePair = useCallback(
    async (nodeAId: string, nodeBId: string): Promise<VotePairResult> => {
      const fail = (error: string): VotePairResult => ({
        error, count: 0, threshold: PAIR_VOTE_THRESHOLD, linked: false,
      });
      if (!room || !playerId || !room.gameState) return fail('Not connected to a room.');
      if (room.status !== 'playing') return fail('Voting is only open during a game.');

      const a = room.nodes?.[nodeAId];
      const b = room.nodes?.[nodeBId];
      if (!a || !b || a.id === b.id) return fail('Pick two different words.');

      const { wordANodeId, wordBNodeId } = room.gameState;
      if (
        (a.id === wordANodeId && b.id === wordBNodeId) ||
        (a.id === wordBNodeId && b.id === wordANodeId)
      ) return fail("The two goal words can't be linked directly.");

      const alreadyLinked = Object.values(room.edges ?? {}).some(
        (e) => (e.source === a.id && e.target === b.id) || (e.source === b.id && e.target === a.id),
      );
      if (alreadyLinked) return fail('These words are already connected.');

      const ip = room.players?.[playerId]?.ip;
      const { count, learned } = await castPairVote(a.word, b.word, playerId, ip);

      if (learned) {
        // Re-check against fresh edges: another player may have linked it meanwhile
        const freshEdges = Object.values(await fetchEdges(roomId));
        const exists = freshEdges.some(
          (e) => (e.source === a.id && e.target === b.id) || (e.source === b.id && e.target === a.id),
        );
        if (!exists) {
          await addEdge(roomId, a.id, b.id, playerId, 'vote');
          await relayout(roomId);
        }
      }

      return { error: null, count, threshold: PAIR_VOTE_THRESHOLD, linked: learned };
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

  return { handleAddWord, handleVotePair, handleDeleteNode, handleNodeDragStop };
}
