import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { useRoomSubscription } from '../hooks/useRoomSubscription';
import { startGame, deleteRoom, kickPlayer, leaveRoom } from '../services/roomService';
import PlayerList from '../components/PlayerList';
import { useState } from 'react';

export default function LobbyPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const [starting, setStarting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#/join/${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  const handleKick = async (targetPlayerId: string) => {
    if (!roomId) return;
    await kickPlayer(roomId, targetPlayerId).catch(() => {});
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      await startGame(roomId);
      navigate(`/game/${roomId}`);
    } catch {
      setStarting(false);
    }
  };

  const handleLeave = async () => {
    if (!roomId || !playerId) return;
    setLeaving(true);
    try {
      await leaveRoom(roomId, playerId, players);
      navigate('/');
    } catch {
      setLeaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this room? All players will be removed.')) return;
    setDeleting(true);
    try {
      await deleteRoom(roomId);
      navigate('/');
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-sky-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-6">
          <div>
            <h2 className="text-2xl font-black text-brand-600">Room Lobby</h2>
            <p className="text-xs text-gray-400 mt-1 mb-3">Share this code with friends to join</p>
            <div className="flex items-center justify-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
              <span className="font-mono font-black text-2xl tracking-[0.35em] text-gray-800">
                {roomId}
              </span>
            </div>
            <button
              onClick={handleCopyLink}
              className="mt-2 w-full py-2.5 rounded-xl border-2 border-brand-200 bg-brand-50 text-brand-700 font-bold text-sm hover:bg-brand-100 active:bg-brand-200 transition-colors flex items-center justify-center gap-2"
            >
              {copied ? '✓ Copied!' : '🔗 Copy Invite Link'}
            </button>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">
              Players ({playerCount})
            </p>
            <PlayerList
              players={players}
              currentPlayerId={playerId}
              hostId={room.hostId}
              onKick={isHost ? handleKick : undefined}
            />
          </div>

          {isHost ? (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleStart}
                disabled={starting || deleting}
                className="w-full py-3 rounded-xl bg-brand-500 text-white font-bold text-lg hover:bg-brand-600 disabled:opacity-60 transition-colors"
              >
                {starting ? 'Starting…' : 'Start Game'}
              </button>
              <button
                onClick={handleDelete}
                disabled={starting || deleting}
                className="w-full py-2 rounded-xl border border-red-300 text-red-500 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete Room'}
              </button>
              <p className="text-xs text-gray-400 text-center">
                Share the room code with friends before starting.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-center text-gray-500 text-sm">
                Waiting for the host to start the game…
              </p>
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="w-full py-2 rounded-xl border border-red-300 text-red-500 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {leaving ? 'Leaving…' : 'Leave Room'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
