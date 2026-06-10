import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeRoom } from '../services/roomService';
import { useGameStore } from '../store/useGameStore';

/**
 * Subscribes to a Firebase room and keeps the Zustand store in sync.
 * Automatically redirects on game start and win.
 */
export function useRoomSubscription(roomId: string | undefined): void {
  const setRoom = useGameStore((s) => s.setRoom);
  const playerId = useGameStore((s) => s.playerId);
  const navigate = useNavigate();

  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = subscribeRoom(roomId, (room) => {
      setRoom(room);

      if (!room) {
        navigate('/');
        return;
      }

      // Redirect if this player was kicked
      if (playerId && !room.players?.[playerId]) {
        navigate('/');
        return;
      }

      if (room.status === 'playing') {
        // Only redirect from lobby to game
        const hash = window.location.hash;
        if (hash.includes('/lobby')) {
          navigate(`/game/${roomId}`);
        }
      }

      if (room.status === 'waiting') {
        // Redirect everyone back to lobby when host returns
        const hash = window.location.hash;
        if (hash.includes('/game') || hash.includes('/victory')) {
          navigate(`/lobby/${roomId}`);
        }
      }
      // 'won' is handled as a modal overlay inside GamePage — no redirect needed
    });

    return unsubscribe;
  }, [roomId, playerId, setRoom, navigate]);
}
