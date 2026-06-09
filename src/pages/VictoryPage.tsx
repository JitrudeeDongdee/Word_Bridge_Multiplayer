import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * The victory experience is now a modal overlay inside GamePage.
 * Anyone landing on this URL directly is redirected back to the game.
 */
export default function VictoryPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(roomId ? `/game/${roomId}` : '/', { replace: true });
  }, [roomId, navigate]);

  return null;
}
