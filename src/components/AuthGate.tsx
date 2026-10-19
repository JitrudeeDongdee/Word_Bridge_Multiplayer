import { useEffect, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { ensureSignedIn, loadProfile } from '../services/authService';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/useGameStore';

/** Give up waiting for sign-in after this long and show the app anyway */
const READY_TIMEOUT_MS = 8000;

/**
 * Signs everyone in before the app talks to the database (guests anonymously), because
 * the database rules require a signed-in user. Also keeps the room identity in step with
 * the account: a saved player id from another account (or from before accounts existed)
 * is dropped, so the player rejoins with their uid instead of acting as someone else.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const ready = useAuthStore((s) => s.ready);
  const setAuth = useAuthStore((s) => s.set);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuth({ user, memberName: null, memberPhoto: null });
      if (!user) return;
      const { playerId } = useGameStore.getState();
      if (playerId && playerId !== user.uid) useGameStore.setState({ playerId: null, room: null });
      if (!user.isAnonymous) {
        loadProfile(user.uid)
          .then((p) => { if (auth.currentUser?.uid === user.uid) setAuth({ memberName: p?.name ?? user.displayName ?? null, memberPhoto: p?.photo ?? null }); })
          .catch(() => {});
      }
    });
    const timeout = setTimeout(() => setAuth({ ready: true }), READY_TIMEOUT_MS);
    ensureSignedIn().finally(() => { clearTimeout(timeout); setAuth({ ready: true }); });
    return () => { unsub(); clearTimeout(timeout); };
  }, [setAuth]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-sky-100">
        <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-brand-500 animate-spin" aria-label="Loading" />
      </div>
    );
  }
  return <>{children}</>;
}
