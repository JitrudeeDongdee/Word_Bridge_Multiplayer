export type GameStatus = 'waiting' | 'playing' | 'won';

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
  spectator?: boolean;
  joinRequest?: boolean;
}

export interface GameNode {
  id: string;
  word: string;
  x: number;
  y: number;
  createdBy: string;
  isStart: boolean;
  /** Similarity scores against every other node at the time this word was added */
  scores?: SharedWordScore[];
}

export interface GameEdge {
  id: string;
  source: string;
  target: string;
}

export interface GameState {
  wordA: string;
  wordANodeId: string;
  wordB: string;
  wordBNodeId: string;
  startedAt: number;
}

export interface SharedWordScore {
  word: string;
  score: number;
  connected: boolean;
}

export interface LastWordScores {
  addedWord: string;
  scores: SharedWordScore[];
}

export interface Room {
  id: string;
  hostId: string;
  createdAt: number;
  status: GameStatus;
  players: Record<string, Player>;
  nodes: Record<string, GameNode>;
  edges: Record<string, GameEdge>;
  gameState: GameState | null;
  winnerId: string | null;
  winningPath: string[] | null;
  lastWordScores: LastWordScores | null;
  /** Cumulative points per player across all rounds in this room (playerId → pts) */
  scores: Record<string, number>;
  /** Points earned in the most recently completed round (playerId → pts) */
  roundScores: Record<string, number> | null;
  /** History of used pairs stored as "wordA/wordB" — used to avoid repetition */
  usedPairs?: string[];
  /** Timestamp of the last meaningful activity in this room */
  lastActiveAt?: number;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  sentAt: number;
}
