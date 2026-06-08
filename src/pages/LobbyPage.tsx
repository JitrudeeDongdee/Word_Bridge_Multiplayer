import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { useRoomSubscription } from '../hooks/useRoomSubscription';
import { startGame } from '../services/roomService';
import PlayerList from '../components/PlayerList';
import { useState } from 'react';

export default function LobbyPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const [starting, setStarting] = useState(false);

  useRoomSubscription(roomId);

  if (!room || !roomId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Connecting to room…
      </div>
    );
  }

  const isHost = room.hostId === playerId;
  const players = room.players ?? {};
  const playerCount = Object.keys(players).length;

  const handleStart = async () => {
    setStarting(true);
    try {
      await startGame(roomId);
      navigate(`/game/${roomId}`);
    } catch {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-sky-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-6">
          <div>
            <h2 className="text-2xl font-black text-brand-600">Room Lobby</h2>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-gray-500 text-sm">Room code:</span>
              <span className="font-mono font-bold text-lg tracking-widest text-gray-800">
                {roomId}
              </span>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">
              Players ({playerCount})
            </p>
            <PlayerList players={players} currentPlayerId={playerId} />
          </div>

          {isHost ? (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleStart}
                disabled={starting}
                className="w-full py-3 rounded-xl bg-brand-500 text-white font-bold text-lg hover:bg-brand-600 disabled:opacity-60 transition-colors"
              >
                {starting ? 'Starting…' : 'Start Game'}
              </button>
              <p className="text-xs text-gray-400 text-center">
                Share the room code with friends before starting.
              </p>
            </div>
          ) : (
            <p className="text-center text-gray-500 text-sm">
              Waiting for the host to start the game…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
