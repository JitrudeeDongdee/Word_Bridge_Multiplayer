import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Room } from '../types';

interface GameStore {
  // Identity
  playerId: string | null;
  playerName: string | null;

  // Current room (mirrored from Firebase)
  room: Room | null;

  // Actions
  setIdentity: (playerId: string, playerName: string) => void;
  setRoom: (room: Room | null) => void;
  clearSession: () => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    // No getters in this state object: persist's hydration spreads it, which would run the
    // getter before the store exists, throw, and silently skip restoring the saved identity
    // (every reload logged the player out of their room).
    (set) => ({
      playerId: null,
      playerName: null,
      room: null,

      setIdentity: (playerId, playerName) => set({ playerId, playerName }),
      setRoom: (room) => set({ room }),
      clearSession: () => set({ playerId: null, playerName: null, room: null }),
    }),
    {
      name: 'wb-session',
      // Only persist identity — room data comes from Firebase on reconnect
      partialize: (state) => ({
        playerId: state.playerId,
        playerName: state.playerName,
      }),
    },
  ),
);
