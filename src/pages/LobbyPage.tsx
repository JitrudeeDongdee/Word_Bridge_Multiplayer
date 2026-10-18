import { ArrowLeft, Check, Link2, Lock, Settings } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { useRoomSubscription } from '../hooks/useRoomSubscription';
import { startGame, deleteRoom, kickPlayer, leaveRoom } from '../services/roomService';
import PlayerList from '../components/PlayerList';
import RoomSettings from '../components/RoomSettings';
import { useState } from 'react';
import { defaultRoomName } from '../services/roomIndexService';

export default function LobbyPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const [starting, setStarting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  /** Leave the room (if in it) and open the main lobby. */
  const handleMainLobby = async () => {
    if (!roomId || !playerId || !players[playerId]) {
      navigate('/rooms');
      return;
    }
    if (playerCount === 1 && !window.confirm('You are the only player — leaving closes this room. Go to the main lobby?')) {
      return;
    }
    setLeaving(true);
    try {
      await leaveRoom(roomId, playerId, players);
      navigate('/rooms');
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
        <button
          onClick={handleMainLobby}
          disabled={leaving || deleting || starting}
          className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden /> Main lobby
        </button>
        <div className="relative bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-6">
          {/* Host-only: room settings live behind the gear so they don't take space all the time */}
          {isHost && (
            <button
              onClick={() => setShowSettings((v) => !v)}
              aria-label="Room settings"
              aria-expanded={showSettings}
              aria-controls="lobby-room-settings"
              title="Room settings"
              className={`absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                showSettings ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
              }`}
            >
              <Settings className={`w-5 h-5 transition-transform ${showSettings ? 'rotate-90' : ''}`} aria-hidden />
            </button>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Room Lobby</p>
            {/* pr leaves room for the host's gear */}
            <h2 className={`text-2xl font-black text-brand-600 break-words${isHost ? ' pr-8' : ''}`}>
              {room.name || defaultRoomName(players[room.hostId]?.name ?? 'Someone')}
            </h2>
            <p className="text-xs text-gray-400 mt-1 mb-3">
              Room code — friends use it to find this room
              {room.passwordHash && (
                <span className="flex items-center gap-1 mt-0.5 text-amber-600">
                  <Lock className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                  Locked: they'll also need the password you set (not the code)
                </span>
              )}
            </p>
            <div className="flex items-center justify-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
              <span className="font-mono font-black text-2xl tracking-[0.35em] text-gray-800">
                {roomId}
              </span>
            </div>
            <button
              onClick={handleCopyLink}
              className="mt-2 w-full py-2.5 rounded-xl border-2 border-brand-200 bg-brand-50 text-brand-700 font-bold text-sm hover:bg-brand-100 active:bg-brand-200 transition-colors flex items-center justify-center gap-2"
            >
              {copied ? (
                <><Check className="w-4 h-4" aria-hidden /> Copied!</>
              ) : (
                <><Link2 className="w-4 h-4" aria-hidden /> Copy Invite Link</>
              )}
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

          {isHost && showSettings && (
            <div id="lobby-room-settings">
              <RoomSettings room={room} roomId={roomId} />
            </div>
          )}

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
