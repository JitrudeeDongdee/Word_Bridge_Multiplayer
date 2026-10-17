import { useCallback } from 'react';
import {
  placeNode,
  addEdge,
  fetchNodes,
  fetchEdges,
  saveWordScores,
  updateNodeScores,
  deleteNode,
  deleteEdgesForNode,
  updateNodePosition,
  markNodeChecked,
  batchUpdateNodePositions,
} from '../services/roomService';
import { forceDirectedLayout } from '../utils/graphLayout';
import { addCustomWord } from '../services/customWordsService';
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
  /** Problem found before placing the word (format, duplicate, word cap) */
  error: string | null;
  /**
   * The word is on the board (marked pending) as soon as this result arrives; checking it
   * and drawing its links happens in the background. Resolves with an error message if the
   * word turned out invalid and was removed, otherwise null.
   */
  done: Promise<string | null>;
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

  /** Scores a just-checked word against the board, draws its edges and re-layouts. */
  const linkNewWord = useCallback(
    async (newNodeId: string, newWord: string): Promise<void> => {
      if (!room?.gameState || !playerId) return;

      // Read fresh node/edge data from Firebase to avoid stale Zustand state
      const [freshNodes, freshEdges] = await Promise.all([
        fetchNodes(roomId),
        fetchEdges(roomId),
      ]);

      // Words still being checked are skipped: they may be removed, and they link to
      // this word themselves once their own check finishes
      const existingNodes = Object.values(freshNodes).filter((n) => n.id !== newNodeId && !n.pending);
      if (existingNodes.length === 0) return;

      // Build existing edge set for duplicate prevention
      const edgeSet = new Set(
        Object.values(freshEdges).flatMap((e) => [
          `${e.source}|${e.target}`,
          `${e.target}|${e.source}`,
        ]),
      );
      const hasEdge = (a: string, b: string) =>
        edgeSet.has(`${a}|${b}`);

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

    },
    [room, playerId, roomId, scorePair],
  );

  const handleAddWord = useCallback(
    async (word: string): Promise<AddWordResult> => {
      const fail = (error: string): AddWordResult => ({ error, done: Promise.resolve(null) });

      if (!room || !playerId) return fail('Not connected to a room.');

      const nodes = Object.values(room.nodes ?? {});
      const result = validateWord(word, nodes);
      if (!result.valid) return fail(result.error ?? 'Invalid word.');

      const newWord = word.trim().toLowerCase();
      // Put the word on the board right away; checking and linking continue in the background
      const { nodeId: newNodeId, saved } = placeNode(roomId, newWord, playerId, true);

      const remove = async (message: string) => {
        await deleteEdgesForNode(roomId, newNodeId).catch(() => {});
        await deleteNode(roomId, newNodeId).catch(() => {});
        return message;
      };

      const done = (async (): Promise<string | null> => {
        const [wordCheck] = await Promise.all([checkRealWord(newWord), saved]);
        if (wordCheck === 'not_found')
          return remove(`"${newWord}" wasn't found in the dictionary, so it was removed. Only common English words are allowed — proper nouns like place or person names are not supported.`);
        if (wordCheck === 'network_error')
          return remove(`Couldn't verify "${newWord}", so it was removed. Please check your connection and try again.`);

        // Valid word: remember it for autocomplete (best effort)
        addCustomWord(newWord).catch((err) => console.error('Error saving custom word:', err));

        await linkNewWord(newNodeId, newWord);
        await markNodeChecked(roomId, newNodeId);
        return null;
      })().catch(async (err) => {
        console.error('Error adding word:', err);
        return remove(`Something went wrong adding "${newWord}". Please try again.`);
      });

      return { error: null, done };
    },
    [room, playerId, roomId, linkNewWord],
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
      // Also open after a round ends, so players can review the board and teach missed links.
      // A link added then doesn't change that round's score (it was already tallied).
      if (room.status !== 'playing' && room.status !== 'won') {
        return fail('Voting is only open during a game or right after it.');
      }

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
