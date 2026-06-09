export type GameStatus = 'waiting' | 'playing' | 'won';

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
}

export interface GameNode {
  id: string;
  word: string;
  x: number;
  y: number;
  createdBy: string;
  isStart: boolean;
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
}
