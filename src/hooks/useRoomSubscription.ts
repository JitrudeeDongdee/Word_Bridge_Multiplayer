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
        navigate(`/game/${roomId}`, { replace: true });
      }

      if (room.status === 'waiting') {
        // Redirect everyone back to lobby when host returns to waiting
        const hash = window.location.hash;
        if (hash.includes('/game') || hash.includes('/victory')) {
          navigate(`/lobby/${roomId}`, { replace: true });
        }
      }
      // 'won' is handled as a modal overlay inside GamePage — no redirect needed
    });

    return unsubscribe;
  }, [roomId, playerId, setRoom, navigate]);
}
