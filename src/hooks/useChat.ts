import { useEffect, useState, useCallback } from 'react';
import { ref, push, query, limitToLast, onValue, off } from 'firebase/database';
import { db } from '../services/firebase';
import type { ChatMessage } from '../types';

const MAX_MESSAGES = 50;

export function useChat(roomId: string | undefined, playerId: string | undefined, playerName: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!roomId) return;
    const chatRef = query(ref(db, `rooms/${roomId}/chat`), limitToLast(MAX_MESSAGES));

    const handleValue = (snapshot: { exists: () => boolean; val: () => Record<string, Omit<ChatMessage, 'id'>> }) => {
      if (!snapshot.exists()) { setMessages([]); return; }
      const data = snapshot.val();
      const msgs: ChatMessage[] = Object.entries(data).map(([id, msg]) => ({ id, ...msg }));
      msgs.sort((a, b) => a.sentAt - b.sentAt);
      setMessages(msgs);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onValue(chatRef as any, handleValue as any);
    return () => { off(chatRef as any, 'value', handleValue as any); };
  }, [roomId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!roomId || !playerId || !playerName) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      await push(ref(db, `rooms/${roomId}/chat`), {
        playerId,
        playerName,
        text: trimmed,
        sentAt: Date.now(),
      });
    },
    [roomId, playerId, playerName],
  );

  return { messages, sendMessage };
}
