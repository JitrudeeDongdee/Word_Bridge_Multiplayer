import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory localStorage (this test environment doesn't provide one)
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => { data.delete(k); },
    setItem: (k, v) => { data.set(k, String(v)); },
  };
}

describe('useGameStore session persistence', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    vi.resetModules();
  });

  it('restores the player identity saved before a page reload', async () => {
    localStorage.setItem(
      'wb-session',
      JSON.stringify({ state: { playerId: 'p-123', playerName: 'BoldFox' }, version: 0 }),
    );
    const { useGameStore } = await import('../store/useGameStore');
    expect(useGameStore.getState().playerId).toBe('p-123');
    expect(useGameStore.getState().playerName).toBe('BoldFox');
  });

  it('keeps the identity in storage when room data arrives after reload', async () => {
    localStorage.setItem(
      'wb-session',
      JSON.stringify({ state: { playerId: 'p-123', playerName: 'BoldFox' }, version: 0 }),
    );
    const { useGameStore } = await import('../store/useGameStore');
    useGameStore.getState().setRoom(null); // first write after load (room subscription)
    expect(JSON.parse(localStorage.getItem('wb-session')!).state.playerId).toBe('p-123');
  });
});
