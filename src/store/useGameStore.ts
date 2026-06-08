import { create } from 'zustand';
import type { Room, Player } from '../types';

interface GameStore {
  // Identity
  playerId: string | null;
  playerName: string | null;

  // Current room (mirrored from Firebase)
  room: Room | null;

  // Derived convenience getters
  currentPlayer: Player | null;

  // Actions
  setIdentity: (playerId: string, playerName: string) => void;
  setRoom: (room: Room | null) => void;
  clearSession: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  playerId: null,
  playerName: null,
  room: null,

  get currentPlayer() {
    const { room, playerId } = get();
    if (!room || !playerId) return null;
    return room.players?.[playerId] ?? null;
  },

  setIdentity: (playerId, playerName) => set({ playerId, playerName }),

  setRoom: (room) => set({ room }),

  clearSession: () => set({ playerId: null, playerName: null, room: null }),
}));
