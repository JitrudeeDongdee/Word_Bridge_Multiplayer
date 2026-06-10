import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

/**
 * Returns true once the Zustand store has been rehydrated from localStorage.
 * Uses the Zustand v5 persist API directly for reliable hydration detection.
 */
export function useHasHydrated(): boolean {
  const [hydrated, setHydrated] = useState<boolean>(
    () => useGameStore.persist.hasHydrated(),
  );

  useEffect(() => {
    // Already hydrated (synchronous localStorage case)
    if (useGameStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    // Subscribe for async hydration
    const unsub = useGameStore.persist.onFinishHydration(() => setHydrated(true));
    // Double-check in case it hydrated between render and this effect
    if (useGameStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  return hydrated;
}
