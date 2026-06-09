import { useEffect, useState } from 'react';
import { ref, onValue, set, remove, onDisconnect, runTransaction } from 'firebase/database';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/firebase';

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

export function usePresence() {
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  useEffect(() => {
    const sessionId = getSessionId();
    const presenceRef = ref(db, `presence/${sessionId}`);
    const totalRef = ref(db, 'stats/totalPlayers');

    // เขียน presence ตอนเปิด, ลบอัตโนมัติตอน disconnect
    set(presenceRef, { joinedAt: Date.now(), device: getDeviceType() });
    onDisconnect(presenceRef).remove();

    // นับ total 1 ครั้งต่อ session
    if (!sessionStorage.getItem('wb_counted')) {
      runTransaction(totalRef, (cur) => (cur ?? 0) + 1);
      sessionStorage.setItem('wb_counted', '1');
    }

    // ฟัง online count
    const unsubOnline = onValue(ref(db, 'presence'), (snap) => {
      setOnlineCount(snap.size);
    });

    // ฟัง total count
    const unsubTotal = onValue(totalRef, (snap) => {
      setTotalCount(snap.val() ?? 0);
    });

    return () => {
      remove(presenceRef);
      unsubOnline();
      unsubTotal();
    };
  }, []);

  return { onlineCount, totalCount };
}
