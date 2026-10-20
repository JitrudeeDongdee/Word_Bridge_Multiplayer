import {
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  off,
  runTransaction,
  serverTimestamp,
} from 'firebase/database';
import { v4 as uuidv4 } from 'uuid';
import { db } from './firebase';
import { dropGhostNodes } from '../utils/ghostNodes';
import { currentUid } from './authService';
import { useAuthStore } from '../store/useAuthStore';

/** The signed-in member's avatar, shown to the others in the room (guests have none). */
const myPhoto = (): { photo?: string } => {
  const photo = useAuthStore.getState().memberPhoto;
  return photo ? { photo } : {};
};
import type { Room, Player, GameNode, GameEdge, SharedWordScore, LastWordScores, RoundBreakdown } from '../types';
import { pickWordPair } from '../utils/wordPairs';
import { generateRoomCode } from '../utils/generateRoomCode';
import { newPasswordSalt, hashRoomPassword, checkRoomPassword } from '../utils/roomPassword';
import { syncRoomIndex, removeFromRoomIndex, findOrphanIndexIds, defaultRoomName } from './roomIndexService';
import { logRound } from './leaderboardService';
import { track } from './analytics';

// --- Room operations ---

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/** Deletes stale rooms to keep the database tidy. */
async function cleanOldRooms(): Promise<void> {
  const snapshot = await get(ref(db, 'rooms'));
  if (!snapshot.exists()) return;

  const rooms = snapshot.val() as Record<string, Room>;
  const now = Date.now();

  const deleteOps = Object.values(rooms)
    .filter((room) => {
      if (room.lastActiveAt == null) return true;
      const idleTime = now - room.lastActiveAt;
      const totalAge = now - (room.createdAt ?? 0);
      return (
        totalAge > TWENTY_FOUR_HOURS_MS ||
        (room.status === 'won' && idleTime > THIRTY_MINUTES_MS) ||
        (room.status !== 'won' && idleTime > TWO_HOURS_MS)
      );
    })
    .map((room) => room.id);

  await Promise.all(deleteOps.map((id) => remove(ref(db, `rooms/${id}`))));
  // Drop their public summaries too, plus summaries of rooms that are already gone
  const remaining = new Set(Object.keys(rooms).filter((id) => !deleteOps.includes(id)));
  await removeFromRoomIndex([...deleteOps, ...(await findOrphanIndexIds(remaining))]);
}

export async function deleteRoom(roomId: string): Promise<void> {
  await remove(ref(db, `rooms/${roomId}`));
  await removeFromRoomIndex([roomId]);
}

export async function kickPlayer(roomId: string, playerId: string): Promise<void> {
  await remove(ref(db, `rooms/${roomId}/players/${playerId}`));
  await syncRoomIndex(roomId);
}

export async function leaveRoom(
  roomId: string,
  playerId: string,
  players: Record<string, import('../types').Player>,
): Promise<void> {
  const remaining = Object.values(players).filter((p) => p.id !== playerId);

  const updates: Record<string, unknown> = {
    [`rooms/${roomId}/players/${playerId}`]: null,
  };

  if (remaining.length === 0) {
    // Last one out: the room stays open (same code, board and scores) so players can come
    // back to it; the stale-room cleanup removes it after 2 hours idle. Keep the name it was
    // listed under, since the default one comes from the (now absent) host's name.
    const snap = await get(ref(db, `rooms/${roomId}/name`));
    if (!snap.exists()) {
      updates[`rooms/${roomId}/name`] = defaultRoomName(players[playerId]?.name ?? 'Someone');
    }
    updates[`rooms/${roomId}/lastActiveAt`] = Date.now();
    await update(ref(db), updates);
    await syncRoomIndex(roomId);
    return;
  }

  // Transfer host if the leaving player is the current host
  const isHost = players[playerId]?.isHost;
  if (isHost) {
    const nextHost = remaining.sort((a, b) => a.joinedAt - b.joinedAt)[0];
    updates[`rooms/${roomId}/hostId`] = nextHost.id;
    updates[`rooms/${roomId}/players/${nextHost.id}/isHost`] = true;
  }

  await update(ref(db), updates);
  await syncRoomIndex(roomId);
}

export async function requestJoinGame(roomId: string, playerId: string): Promise<void> {
  await update(ref(db, `rooms/${roomId}/players/${playerId}`), { joinRequest: true });
}

export async function approveJoinRequest(roomId: string, playerId: string): Promise<void> {
  await update(ref(db, `rooms/${roomId}/players/${playerId}`), {
    spectator: null,
    joinRequest: null,
  });
}

export async function denyJoinRequest(roomId: string, playerId: string): Promise<void> {
  await update(ref(db, `rooms/${roomId}/players/${playerId}`), { joinRequest: null });
}

export interface CreateRoomOptions {
  /** Shown in the public room list; defaults to "<host>'s room" */
  name?: string;
  /** Join password (separate from the room code); empty = open room */
  password?: string;
}

export async function createRoom(
  hostName: string,
  hostIp?: string,
  options: CreateRoomOptions = {},
): Promise<{ room: Room; playerId: string }> {
  // Clean up stale rooms before creating a new one (best-effort; don't block on failure)
  await cleanOldRooms().catch(() => {});

  const roomId = generateRoomCode();
  // The signed-in uid (database rules check it); a random id only if auth is unavailable
  const playerId = currentUid() ?? uuidv4();

  const host: Player = {
    id: playerId,
    name: hostName,
    isHost: true,
    joinedAt: Date.now(),
    ...(hostIp ? { ip: hostIp } : {}),
    ...myPhoto(),
  };

  const room: Room = {
    id: roomId,
    hostId: playerId,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
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

  const name = options.name?.trim();
  if (name) room.name = name.slice(0, 30);
  const password = options.password ?? '';
  if (password) {
    room.passwordSalt = newPasswordSalt();
    room.passwordHash = await hashRoomPassword(password, room.passwordSalt);
  }

  await set(ref(db, `rooms/${roomId}`), room);
  await syncRoomIndex(roomId);
  track('create_room', { has_password: !!options.password });
  return { room, playerId };
}

export interface RoomSettingsUpdate {
  /** New display name; empty string resets to the default "<host>'s room" */
  name?: string;
  /** New join password; null removes the lock. Omit to leave the password as is. */
  password?: string | null;
}

/**
 * Host-only room settings (the UI shows them to the host only). No old password is
 * needed, so a host who forgot it can set a new one or open the room. Players already
 * in the room stay; the password only applies to new joiners.
 */
export async function updateRoomSettings(roomId: string, settings: RoomSettingsUpdate): Promise<void> {
  const updates: Record<string, unknown> = { lastActiveAt: Date.now() };
  if (settings.name !== undefined) {
    const name = settings.name.trim().slice(0, 30);
    updates.name = name || null;
  }
  if (settings.password === null || settings.password === '') {
    updates.passwordHash = null;
    updates.passwordSalt = null;
  } else if (settings.password !== undefined) {
    const salt = newPasswordSalt();
    updates.passwordSalt = salt;
    updates.passwordHash = await hashRoomPassword(settings.password, salt);
  }
  await update(ref(db, `rooms/${roomId}`), updates);
  await syncRoomIndex(roomId);
}

export type JoinRoomResult =
  | { ok: true; room: Room; playerId: string }
  | { ok: false; reason: 'not_found' | 'password_required' | 'wrong_password' };

export async function joinRoom(
  roomId: string,
  playerName: string,
  playerIp?: string,
  password?: string,
): Promise<JoinRoomResult> {
  const snapshot = await get(ref(db, `rooms/${roomId}`));
  if (!snapshot.exists()) return { ok: false, reason: 'not_found' };

  const room = snapshot.val() as Room;
  if (room.passwordHash && room.passwordSalt) {
    if (!password) return { ok: false, reason: 'password_required' };
    if (!(await checkRoomPassword(password, room.passwordSalt, room.passwordHash))) {
      return { ok: false, reason: 'wrong_password' };
    }
  }

  const playerId = currentUid() ?? uuidv4();
  // Mid-round joiners watch until approved — unless nobody is playing (an abandoned room
  // someone came back to), then they just play
  const someonePlaying = Object.values(room.players ?? {}).some((p) => p.id !== playerId && !p.spectator);
  const player: Player = {
    id: playerId,
    name: playerName,
    // The room's own host coming back gets the room back
    isHost: room.hostId === playerId,
    joinedAt: Date.now(),
    ...(playerIp ? { ip: playerIp } : {}),
    ...(room.status !== 'waiting' && someonePlaying ? { spectator: true } : {}),
    ...myPhoto(),
  };

  await update(ref(db, `rooms/${roomId}/players`), { [playerId]: player });
  await syncRoomIndex(roomId);
  const updated = { ...room, players: { ...room.players, [playerId]: player } };
  track('join_room', { has_password: !!room.passwordHash, as_spectator: room.status !== 'waiting' });
  return { ok: true, room: updated, playerId };
}

/** Read usedPairs from Firebase — stored as a pipe-separated string to avoid
 *  Firebase's array→object conversion quirks that can corrupt the history. */
function parseUsedPairs(snap: { exists: () => boolean; val: () => unknown }): string[] {
  if (!snap.exists()) return [];
  const raw = snap.val();
  // New format: pipe-separated string  "fire/snow|ocean/mountain|..."
  if (typeof raw === 'string') return raw ? raw.split('|') : [];
  // Legacy format: Firebase array/object  {0: "fire/snow", ...} or ["fire/snow", ...]
  if (Array.isArray(raw)) return (raw as string[]).filter(Boolean);
  if (typeof raw === 'object' && raw !== null) return Object.values(raw as Record<string, string>).filter(Boolean);
  return [];
}

export async function startGame(roomId: string): Promise<void> {
  // Read history to avoid repeating recent pairs / categories
  const histSnap = await get(ref(db, `rooms/${roomId}/usedPairs`));
  const usedPairs = parseUsedPairs(histSnap);

  const [wordA, wordB] = pickWordPair(usedPairs);
  const updatedUsedPairs = [...usedPairs, `${wordA}/${wordB}`].slice(-90);
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
    [`rooms/${roomId}/usedPairs`]: updatedUsedPairs.join('|'),
    [`rooms/${roomId}/lastActiveAt`]: Date.now(),
  };

  await update(ref(db), updates);
  await syncRoomIndex(roomId);
  track('game_start');
}

export async function restartGame(roomId: string): Promise<void> {
  // Read history to avoid repeating recent pairs / categories
  const histSnap = await get(ref(db, `rooms/${roomId}/usedPairs`));
  const usedPairs = parseUsedPairs(histSnap);

  const [wordA, wordB] = pickWordPair(usedPairs);
  const updatedUsedPairs = [...usedPairs, `${wordA}/${wordB}`].slice(-90);
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
    [`rooms/${roomId}/roundBreakdown`]: null,
    [`rooms/${roomId}/usedPairs`]: updatedUsedPairs.join('|'),
    [`rooms/${roomId}/lastActiveAt`]: Date.now(),
    // `scores` (cumulative) is intentionally not cleared
  };

  // Promote any spectators to full players for this round
  const playersSnap = await get(ref(db, `rooms/${roomId}/players`));
  if (playersSnap.exists()) {
    for (const pid of Object.keys(playersSnap.val())) {
      updates[`rooms/${roomId}/players/${pid}/spectator`] = null;
    }
  }

  await update(ref(db), updates);
  await syncRoomIndex(roomId);
  track('game_restart');
}

/** How long the victory screen counts down before the next round starts by itself. */
export const NEXT_ROUND_DELAY_MS = 5000;
/** A claim older than this is treated as abandoned (that client closed mid-restart). */
const NEXT_ROUND_CLAIM_MS = 15000;
/** When everyone still sees the victory screen this long after the countdown, try again. */
export const NEXT_ROUND_RETRY_MS = NEXT_ROUND_CLAIM_MS + 1000;

/**
 * Starts the next round after a win — at most once, however many players' countdowns (or
 * "Play again" clicks) fire together. The first to claim `nextRound` for this round restarts;
 * everyone else backs off. Returns whether this call started it.
 */
export async function startNextRound(roomId: string, round: string): Promise<boolean> {
  const now = Date.now();
  const { committed } = await runTransaction(ref(db, `rooms/${roomId}/nextRound`), (claim) => {
    const c = claim as { round?: string; at?: number } | null;
    if (c?.round === round && now - (c.at ?? 0) < NEXT_ROUND_CLAIM_MS) return; // taken
    return { round, at: now };
  });
  if (!committed) return false;
  const status = await get(ref(db, `rooms/${roomId}/status`));
  if (status.val() !== 'won') return false;
  await restartGame(roomId);
  return true;
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
    roundBreakdown: null,
    // `scores` (cumulative) intentionally preserved
  });
  await syncRoomIndex(roomId);
}

// --- Node operations ---

export async function fetchNodes(roomId: string): Promise<Record<string, GameNode>> {
  const snapshot = await get(ref(db, `rooms/${roomId}/nodes`));
  if (!snapshot.exists()) return {};
  return dropGhostNodes({ nodes: snapshot.val() } as Room).room.nodes ?? {};
}

export async function fetchEdges(roomId: string): Promise<Record<string, GameEdge>> {
  const snapshot = await get(ref(db, `rooms/${roomId}/edges`));
  return snapshot.exists() ? (snapshot.val() as Record<string, GameEdge>) : {};
}

export async function addNode(
  roomId: string,
  word: string,
  playerId: string,
  pending = false,
): Promise<string> {
  const { nodeId, saved } = placeNode(roomId, word, playerId, pending);
  await saved;
  return nodeId;
}

/**
 * Like addNode, but returns the new id immediately. The Firebase SDK shows the write to
 * local listeners straight away; `saved` resolves when the server confirms it (~1s).
 */
export function placeNode(
  roomId: string,
  word: string,
  playerId: string,
  pending = false,
): { nodeId: string; saved: Promise<void> } {
  const nodeId = uuidv4();
  const node: GameNode = {
    id: nodeId,
    word: word.trim().toLowerCase(),
    x: 200 + Math.random() * 600,
    y: 100 + Math.random() * 400,
    createdBy: playerId,
    isStart: false,
    ...(pending ? { pending: true } : {}),
  };
  const saved = Promise.all([
    set(ref(db, `rooms/${roomId}/nodes/${nodeId}`), node),
    update(ref(db, `rooms/${roomId}`), { lastActiveAt: Date.now() }),
  ]).then(() => undefined);
  track('add_word');
  return { nodeId, saved };
}

export async function updateNodePosition(
  roomId: string,
  nodeId: string,
  x: number,
  y: number,
): Promise<void> {
  await moveNodeIfExists(roomId, nodeId, x, y);
}

/**
 * Transaction, not update(): update() would recreate a node that was deleted meanwhile
 * (a word rejected while being dragged / relaid out) as a word-less `{ x, y }` ghost.
 */
async function moveNodeIfExists(roomId: string, nodeId: string, x: number, y: number): Promise<void> {
  await runTransaction(ref(db, `rooms/${roomId}/nodes/${nodeId}`), (node) =>
    node ? { ...node, x, y } : undefined,
  );
}

export async function batchUpdateNodePositions(
  roomId: string,
  positions: Record<string, { x: number; y: number }>,
): Promise<void> {
  await Promise.all(Object.entries(positions).map(([nodeId, pos]) => moveNodeIfExists(roomId, nodeId, pos.x, pos.y)));
}

/** Clears a node's pending flag once its word has been checked and linked. */
export async function markNodeChecked(roomId: string, nodeId: string): Promise<void> {
  await update(ref(db, `rooms/${roomId}/nodes/${nodeId}`), { pending: null });
}

export async function deleteNode(roomId: string, nodeId: string): Promise<void> {
  await remove(ref(db, `rooms/${roomId}/nodes/${nodeId}`));
}

// --- Edge operations ---

export async function addEdge(
  roomId: string,
  source: string,
  target: string,
  createdBy: string,
  via: 'auto' | 'vote',
  /** For auto edges: the similarity that created the link */
  sim?: { score: number; datamuse: number },
): Promise<void> {
  const edgeId = uuidv4();
  const edge: GameEdge = {
    id: edgeId, source, target, createdBy, createdAt: Date.now(), via,
    ...(sim ? { score: sim.score, datamuse: sim.datamuse } : {}),
  };
  await Promise.all([
    set(ref(db, `rooms/${roomId}/edges/${edgeId}`), edge),
    update(ref(db, `rooms/${roomId}`), { lastActiveAt: Date.now() }),
  ]);
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

/** Persists the similarity scores permanently on the node itself. */
export async function updateNodeScores(
  roomId: string,
  nodeId: string,
  scores: SharedWordScore[],
): Promise<void> {
  await update(ref(db, `rooms/${roomId}/nodes/${nodeId}`), { scores });
}

export async function markRoomWon(
  roomId: string,
  winnerId: string,
  winningPath: string[],
  roundScores: Record<string, number>,
  roundBreakdown: RoundBreakdown,
): Promise<void> {
  // Read current cumulative scores and merge in round scores
  const snapshot = await get(ref(db, `rooms/${roomId}/scores`));
  const current: Record<string, number> = snapshot.exists()
    ? (snapshot.val() as Record<string, number>)
    : {};
  const merged: Record<string, number> = { ...current };
  for (const [pid, pts] of Object.entries(roundScores)) {
    // Round points can be fractional (shared pots); keep one decimal without float drift
    merged[pid] = Math.round(((merged[pid] ?? 0) + pts) * 10) / 10;
  }
  await update(ref(db, `rooms/${roomId}`), {
    status: 'won',
    winnerId,
    winningPath,
    roundScores,
    roundBreakdown,
    scores: merged,
  });
  await syncRoomIndex(roomId);
  track('round_end', { players: Object.keys(roundScores).length, path_length: winningPath.length });
  // Leaderboard (crowns + points across all rooms); never blocks the win
  await logRound(roomId, roundScores).catch(() => {});
}

// --- Subscriptions ---

export function subscribeRoom(roomId: string, callback: (room: Room | null) => void): () => void {
  const roomRef = ref(db, `rooms/${roomId}`);
  onValue(roomRef, (snapshot) => {
    if (!snapshot.exists()) return callback(null);
    // Hide word-less ghost nodes and clean them out of the room (any client may do it)
    const { room, ghostIds } = dropGhostNodes(snapshot.val() as Room);
    if (ghostIds.length > 0) {
      update(ref(db, `rooms/${roomId}/nodes`), Object.fromEntries(ghostIds.map((id) => [id, null]))).catch(() => {});
    }
    callback(room);
  });
  return () => off(roomRef);
}
