import { useEffect, useRef, useState } from 'react';
import { ref, onValue, set, update, remove, onDisconnect, runTransaction } from 'firebase/database';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/firebase';
import type { PresenceEntry } from '../utils/players';

function getDeviceType(): 'mobile' | 'desktop' {
  return /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
}

function getSessionId(): string {
  const KEY = 'wb_session_id';
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = uuidv4();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

export interface PresenceInfo {
  uid: string | null;
  name: string | null;
  member: boolean;
  roomId: string | undefined;
}

/**
 * Keeps this tab's `presence/{sessionId}` up to date for as long as the app is open (any page):
 * who it is and which room it is in. The entry is removed when the tab closes or disconnects.
 */
export function usePresenceTracker({ uid, name, member, roomId }: PresenceInfo) {
  const [sessionId] = useState(getSessionId);
  // Latest "who and where", for re-creating the entry after a reconnect
  const info = useRef<Record<string, unknown>>({});
  // Declared first so the effects below already see this render's values
  useEffect(() => {
    info.current = { uid, name: name ? name.slice(0, 30) : null, member, roomId: roomId ?? null };
  }, [uid, name, member, roomId]);

  // (Re)create the entry on every (re)connect; the server removes it on disconnect
  useEffect(() => {
    const presenceRef = ref(db, `presence/${sessionId}`);
    const joinedAt = Date.now();
    const unsub = onValue(ref(db, '.info/connected'), (snap) => {
      if (snap.val() !== true) return;
      onDisconnect(presenceRef).remove()
        .then(() => set(presenceRef, { joinedAt, device: getDeviceType(), ...withoutEmpty(info.current) }))
        .catch(() => {});
    });

    // นับ total 1 ครั้งต่อ session
    if (!sessionStorage.getItem('wb_counted')) {
      runTransaction(ref(db, 'stats/totalPlayers'), (cur) => (cur ?? 0) + 1).catch(() => {});
      sessionStorage.setItem('wb_counted', '1');
    }
    return () => { unsub(); remove(presenceRef).catch(() => {}); };
  }, [sessionId]);

  // Who and where changed — null removes a field
  useEffect(() => {
    if (!uid) return;
    update(ref(db, `presence/${sessionId}`), info.current).catch(() => {});
  }, [sessionId, uid, name, member, roomId]);
}

const withoutEmpty = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));

/** Every open tab, live. */
export function usePresenceSessions(): PresenceEntry[] | null {
  const [sessions, setSessions] = useState<PresenceEntry[] | null>(null);
  useEffect(
    () => onValue(
      ref(db, 'presence'),
      (snap) => setSessions(Object.values((snap.val() ?? {}) as Record<string, PresenceEntry>)),
      () => setSessions([]),
    ),
    [],
  );
  return sessions;
}

/** "N online now" and the all-time player counter for the home page. */
export function usePresence() {
  const sessions = usePresenceSessions();
  const [totalCount, setTotalCount] = useState<number | null>(null);

  useEffect(() => onValue(ref(db, 'stats/totalPlayers'), (snap) => setTotalCount(snap.val() ?? 0)), []);

  return { onlineCount: sessions ? sessions.length : null, totalCount };
}
