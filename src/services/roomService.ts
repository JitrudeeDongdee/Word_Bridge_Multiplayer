import {
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  off,
  serverTimestamp,
} from 'firebase/database';
import { v4 as uuidv4 } from 'uuid';
import { db } from './firebase';
import type { Room, Player, GameNode, GameEdge, SharedWordScore, LastWordScores } from '../types';
import { WORD_PAIRS } from '../utils/wordPairs';
import { generateRoomCode } from '../utils/generateRoomCode';

// --- Room operations ---

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/** Deletes stale rooms to keep the database tidy. */
async function cleanOldRooms(): Promise<void> {
  const snapshot = await get(ref(db, 'rooms'));
  if (!snapshot.exists()) return;

  const rooms = snapshot.val() as Record<string, Room>;
  const now = Date.now();

  const deleteOps = Object.values(rooms)
    .filter((room) => {
      const age = now - (room.createdAt ?? 0);
      return (
        age > TWENTY_FOUR_HOURS_MS ||
        (room.status === 'won' && age > THIRTY_MINUTES_MS)
      );
    })
    .map((room) => remove(ref(db, `rooms/${room.id}`)));

  await Promise.all(deleteOps);
}

export async function deleteRoom(roomId: string): Promise<void> {
  await remove(ref(db, `rooms/${roomId}`));
}

export async function kickPlayer(roomId: string, playerId: string): Promise<void> {
  await remove(ref(db, `rooms/${roomId}/players/${playerId}`));
}

export async function createRoom(hostName: string): Promise<{ room: Room; playerId: string }> {
  // Clean up stale rooms before creating a new one (best-effort; don't block on failure)
  await cleanOldRooms().catch(() => {});

  const roomId = generateRoomCode();
  const playerId = uuidv4();

  const host: Player = {
    id: playerId,
    name: hostName,
    isHost: true,
    joinedAt: Date.now(),
  };

  const room: Room = {
    id: roomId,
    hostId: playerId,
    createdAt: Date.now(),
    status: 'waiting',
    players: { [playerId]: host },
    nodes: {},
    edges: {},
    gameState: null,
    winnerId: null,
    winningPath: null,
    lastWordScores: null,
    scores: {},
    roundScores: null,
  };

  await set(ref(db, `rooms/${roomId}`), room);
  return { room, playerId };
}

export async function joinRoom(
  roomId: string,
  playerName: string,
): Promise<{ room: Room; playerId: string } | null> {
  const snapshot = await get(ref(db, `rooms/${roomId}`));
  if (!snapshot.exists()) return null;

  const room = snapshot.val() as Room;
  if (room.status !== 'waiting') return null;

  const playerId = uuidv4();
  const player: Player = {
    id: playerId,
    name: playerName,
    isHost: false,
    joinedAt: Date.now(),
  };

  await update(ref(db, `rooms/${roomId}/players`), { [playerId]: player });
  const updated = { ...room, players: { ...room.players, [playerId]: player } };
  return { room: updated, playerId };
}

export async function startGame(roomId: string): Promise<void> {
  const [wordA, wordB] = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
  const wordANodeId = uuidv4();
  const wordBNodeId = uuidv4();

  const nodeA: GameNode = {
    id: wordANodeId,
    word: wordA,
    x: 100,
    y: 300,
    createdBy: 'system',
    isStart: true,
  };

  const nodeB: GameNode = {
    id: wordBNodeId,
    word: wordB,
    x: 900,
    y: 300,
    createdBy: 'system',
    isStart: true,
  };

  const updates: Record<string, unknown> = {
    [`rooms/${roomId}/status`]: 'playing',
    [`rooms/${roomId}/nodes/${wordANodeId}`]: nodeA,
    [`rooms/${roomId}/nodes/${wordBNodeId}`]: nodeB,
    [`rooms/${roomId}/gameState`]: {
      wordA,
      wordANodeId,
      wordB,
      wordBNodeId,
      startedAt: serverTimestamp(),
    },
  };

  await update(ref(db), updates);
}

export async function restartGame(roomId: string): Promise<void> {
  const [wordA, wordB] = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
  const wordANodeId = uuidv4();
  const wordBNodeId = uuidv4();

  const nodeA: GameNode = {
    id: wordANodeId,
    word: wordA,
    x: 100,
    y: 300,
    createdBy: 'system',
    isStart: true,
  };

  const nodeB: GameNode = {
    id: wordBNodeId,
    word: wordB,
    x: 900,
    y: 300,
    createdBy: 'system',
    isStart: true,
  };

  const updates: Record<string, unknown> = {
    [`rooms/${roomId}/status`]: 'playing',
    [`rooms/${roomId}/nodes`]: { [wordANodeId]: nodeA, [wordBNodeId]: nodeB },
    [`rooms/${roomId}/edges`]: null,
    [`rooms/${roomId}/gameState`]: {
      wordA,
      wordANodeId,
      wordB,
      wordBNodeId,
      startedAt: serverTimestamp(),
    },
    [`rooms/${roomId}/winnerId`]: null,
    [`rooms/${roomId}/winningPath`]: null,
    [`rooms/${roomId}/lastWordScores`]: null,
    [`rooms/${roomId}/roundScores`]: null,
    // `scores` (cumulative) is intentionally not cleared
  };

  await update(ref(db), updates);
}

export async function resetToLobby(roomId: string): Promise<void> {
  await update(ref(db, `rooms/${roomId}`), {
    status: 'waiting',
    nodes: null,
    edges: null,
    gameState: null,
    winnerId: null,
    winningPath: null,
    lastWordScores: null,
    roundScores: null,
    // `scores` (cumulative) intentionally preserved
  });
}

// --- Node operations ---

export async function fetchNodes(roomId: string): Promise<Record<string, GameNode>> {
  const snapshot = await get(ref(db, `rooms/${roomId}/nodes`));
  return snapshot.exists() ? (snapshot.val() as Record<string, GameNode>) : {};
}

export async function fetchEdges(roomId: string): Promise<Record<string, GameEdge>> {
  const snapshot = await get(ref(db, `rooms/${roomId}/edges`));
  return snapshot.exists() ? (snapshot.val() as Record<string, GameEdge>) : {};
}

export async function addNode(roomId: string, word: string, playerId: string): Promise<string> {
  const nodeId = uuidv4();
  const node: GameNode = {
    id: nodeId,
    word: word.trim().toLowerCase(),
    x: 200 + Math.random() * 600,
    y: 100 + Math.random() * 400,
    createdBy: playerId,
    isStart: false,
  };
  await set(ref(db, `rooms/${roomId}/nodes/${nodeId}`), node);
  return nodeId;
}

export async function updateNodePosition(
  roomId: string,
  nodeId: string,
  x: number,
  y: number,
): Promise<void> {
  await update(ref(db, `rooms/${roomId}/nodes/${nodeId}`), { x, y });
}

export async function batchUpdateNodePositions(
  roomId: string,
  positions: Record<string, { x: number; y: number }>,
): Promise<void> {
  const updates: Record<string, number> = {};
  for (const [nodeId, pos] of Object.entries(positions)) {
    updates[`rooms/${roomId}/nodes/${nodeId}/x`] = pos.x;
    updates[`rooms/${roomId}/nodes/${nodeId}/y`] = pos.y;
  }
  if (Object.keys(updates).length > 0) {
    await update(ref(db), updates);
  }
}

export async function deleteNode(roomId: string, nodeId: string): Promise<void> {
  await remove(ref(db, `rooms/${roomId}/nodes/${nodeId}`));
}

// --- Edge operations ---

export async function addEdge(
  roomId: string,
  source: string,
  target: string,
): Promise<void> {
  const edgeId = uuidv4();
  const edge: GameEdge = { id: edgeId, source, target };
  await set(ref(db, `rooms/${roomId}/edges/${edgeId}`), edge);
}

export async function deleteEdge(roomId: string, edgeId: string): Promise<void> {
  await remove(ref(db, `rooms/${roomId}/edges/${edgeId}`));
}

export async function deleteEdgesForNode(roomId: string, nodeId: string): Promise<void> {
  const snapshot = await get(ref(db, `rooms/${roomId}/edges`));
  if (!snapshot.exists()) return;

  const edges = snapshot.val() as Record<string, GameEdge>;
  const deleteOps = Object.values(edges)
    .filter((e) => e.source === nodeId || e.target === nodeId)
    .map((e) => remove(ref(db, `rooms/${roomId}/edges/${e.id}`)));

  await Promise.all(deleteOps);
}

// --- Win state ---

export async function saveWordScores(
  roomId: string,
  addedWord: string,
  scores: SharedWordScore[],
): Promise<void> {
  const payload: LastWordScores = { addedWord, scores };
  await update(ref(db, `rooms/${roomId}`), { lastWordScores: payload });
}

export async function markRoomWon(
  roomId: string,
  winnerId: string,
  winningPath: string[],
  roundScores: Record<string, number>,
): Promise<void> {
  // Read current cumulative scores and merge in round scores
  const snapshot = await get(ref(db, `rooms/${roomId}/scores`));
  const current: Record<string, number> = snapshot.exists()
    ? (snapshot.val() as Record<string, number>)
    : {};
  const merged: Record<string, number> = { ...current };
  for (const [pid, pts] of Object.entries(roundScores)) {
    merged[pid] = (merged[pid] ?? 0) + pts;
  }
  await update(ref(db, `rooms/${roomId}`), {
    status: 'won',
    winnerId,
    winningPath,
    roundScores,
    scores: merged,
  });
}

// --- Subscriptions ---

export function subscribeRoom(roomId: string, callback: (room: Room | null) => void): () => void {
  const roomRef = ref(db, `rooms/${roomId}`);
  onValue(roomRef, (snapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as Room) : null);
  });
  return () => off(roomRef);
}
