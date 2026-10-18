import { ArrowLeft, LayoutList, Lock, Users, X } from 'lucide-react';
import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { createRoom, joinRoom } from '../services/roomService';
import { getPublicIP } from '../utils/network';
import { useGameStore } from '../store/useGameStore';
import { useAuthStore } from '../store/useAuthStore';
import { usePresence } from '../hooks/usePresence';
import AccountButtons from '../components/AccountButtons';
import PolicyLinks from '../components/PolicyLinks';
import { defaultRoomName, joinErrorMessage } from '../services/roomIndexService';
import type { RoomIndexEntry } from '../types';

function randomName(): string {
  const adj = ['Swift', 'Bright', 'Clever', 'Bold', 'Quick', 'Sharp', 'Witty', 'Calm'];
  const noun = ['Fox', 'Owl', 'Lynx', 'Wolf', 'Hawk', 'Bear', 'Deer', 'Crow'];
  return adj[Math.floor(Math.random() * adj.length)] + noun[Math.floor(Math.random() * noun.length)];
}

export default function HomePage() {
  const navigate = useNavigate();
  const setIdentity = useGameStore((s) => s.setIdentity);
  const setRoom = useGameStore((s) => s.setRoom);

  // The main lobby (/rooms) links here with the picked room, or asks for the create form
  const navState = useLocation().state as { room?: RoomIndexEntry; mode?: 'create' } | null;
  const fromLobby = navState?.room ?? null;
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>(navState?.mode === 'create' ? 'create' : 'menu');
  // A member plays under their account name; a guest gets their last name back, or a random one
  const memberName = useAuthStore((s) => s.memberName);
  const lastName = useGameStore((s) => s.playerName);
  const [fallbackName] = useState(randomName);
  // Until the player types one; the member's saved name arrives a moment after sign-in
  const [typedName, setName] = useState<string | null>(null);
  const name = typedName ?? (memberName || lastName || fallbackName);
  const [code, setCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  /** Room picked from the public list (for its name and lock state) */
  const [joinTarget, setJoinTarget] = useState<RoomIndexEntry | null>(fromLobby);
  const [needsPassword, setNeedsPassword] = useState(fromLobby?.hasPassword ?? false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { onlineCount, totalCount } = usePresence();

  const { roomId: inviteRoomId } = useParams<{ roomId?: string }>();

  useEffect(() => {
    if (inviteRoomId) {
      setMode('join');
      setCode(inviteRoomId);
    }
  }, [inviteRoomId]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const hostIp = await getPublicIP();
      const { room, playerId } = await createRoom(name.trim(), hostIp, {
        name: roomName,
        password: createPassword,
      });
      setIdentity(playerId, name.trim());
      setRoom(room);
      navigate(`/lobby/${room.id}`);
    } catch {
      setError('Failed to create room. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const playerIp = await getPublicIP();
      const result = await joinRoom(code.trim().toUpperCase(), name.trim(), playerIp, joinPassword || undefined);
      if (!result.ok) {
        if (result.reason !== 'not_found') setNeedsPassword(true);
        setError(joinErrorMessage(result.reason));
        setLoading(false);
        return;
      }
      setIdentity(result.playerId, name.trim());
      setRoom(result.room);
      const dest = result.room.status === 'waiting'
        ? `/lobby/${result.room.id}`
        : `/game/${result.room.id}`;
      navigate(dest);
    } catch {
      setError('Failed to join room. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const backToMenu = () => {
    setMode('menu');
    setError(null);
    setJoinTarget(null);
    setNeedsPassword(false);
    setJoinPassword('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-sky-100 flex items-center justify-center p-4">
      {/* Accounts placeholder (sign up / log in are coming later) */}
      <div className="fixed top-3 right-4 z-10">
        <AccountButtons />
      </div>
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-brand-600 tracking-tight">Word Bridge</h1>
          <p className="mt-2 text-gray-500 text-sm">
            Collaboratively connect two words with a semantic chain.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {mode === 'menu' && (
            <div className="flex flex-col gap-4">
              <button
                onClick={() => setMode('create')}
                className="w-full py-3 rounded-xl bg-brand-500 text-white font-bold text-lg hover:bg-brand-600 transition-colors"
              >
                Create Room
              </button>
              <button
                onClick={() => setMode('join')}
                className="w-full py-3 rounded-xl border-2 border-brand-500 text-brand-600 font-bold text-lg hover:bg-brand-50 transition-colors"
              >
                Join Room
              </button>
              <button
                onClick={() => navigate('/rooms')}
                className="w-full py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-semibold hover:bg-gray-100 transition-colors inline-flex items-center justify-center gap-2"
              >
                <LayoutList className="w-5 h-5" aria-hidden /> Go to main lobby
              </button>
            </div>
          )}

          {mode === 'create' && (
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <h2 className="text-xl font-bold text-gray-800">Create a Room</h2>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-600">Your name</span>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="px-3 py-2 pr-8 w-full rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    maxLength={20}
                    autoFocus
                  />
                  {name && (
                    <button
                      type="button"
                      onClick={() => setName('')}
                      aria-label="Clear name"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" aria-hidden />
                    </button>
                  )}
                </div>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-600">Room name <span className="text-gray-400">(optional)</span></span>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder={defaultRoomName(name.trim() || 'Your')}
                  className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  maxLength={30}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-600 inline-flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" aria-hidden /> Password <span className="text-gray-400">(optional)</span>
                </span>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Leave empty for an open room"
                  className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  maxLength={40}
                  autoComplete="new-password"
                />
                <span className="text-xs text-gray-400">
                  Players need it to join. It's separate from the room code, which is only for finding the room.
                </span>
              </label>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="py-2.5 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creating…' : 'Create Room'}
              </button>
              <button
                type="button"
                onClick={backToMenu}
                className="inline-flex items-center justify-center gap-1 text-sm text-gray-400 hover:text-gray-600"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> Back
              </button>
            </form>
          )}

          {mode === 'join' && (
            <form onSubmit={handleJoin} className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Join a Room</h2>
                {joinTarget && (
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-1 min-w-0">
                    {joinTarget.hasPassword && <Lock className="w-3.5 h-3.5 flex-shrink-0" aria-label="Locked" />}
                    <b className="truncate">{joinTarget.name}</b>
                    <span className="flex-shrink-0">·</span>
                    <Users className="w-3.5 h-3.5 flex-shrink-0" aria-label="Players" />
                    <span className="flex-shrink-0">{joinTarget.playerCount}</span>
                    {joinTarget.status !== 'waiting' && ' · in progress — you’ll watch until the next round'}
                  </p>
                )}
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-600">Your name</span>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="px-3 py-2 pr-8 w-full rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    maxLength={20}
                    autoFocus
                  />
                  {name && (
                    <button
                      type="button"
                      onClick={() => setName('')}
                      aria-label="Clear name"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" aria-hidden />
                    </button>
                  )}
                </div>
              </label>
              {!inviteRoomId && !joinTarget && (
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-gray-600">Room code</span>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. AB3XY7"
                    className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase tracking-widest font-mono"
                    maxLength={6}
                  />
                </label>
              )}
              {needsPassword && (
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-gray-600 inline-flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" aria-hidden /> Room password
                  </span>
                  <input
                    type="password"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="Ask the host"
                    className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    maxLength={40}
                    autoComplete="off"
                  />
                </label>
              )}
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading || !name.trim() || code.trim().length < 6 || (needsPassword && !joinPassword)}
                className="py-2.5 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Joining…' : 'Join Room'}
              </button>
              {(!inviteRoomId || fromLobby) && (
                <button
                  type="button"
                  onClick={fromLobby ? () => navigate('/rooms') : backToMenu}
                  className="inline-flex items-center justify-center gap-1 text-sm text-gray-400 hover:text-gray-600"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> Back
                </button>
              )}
            </form>
          )}
        </div>

        {/* Stats bar */}
        <div className="flex justify-center gap-5 mt-5 text-sm">
          <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
            {onlineCount === null ? '…' : onlineCount} online now
          </div>
          <div className="text-gray-300">·</div>
          <div className="text-gray-400">
            {totalCount === null ? '…' : totalCount.toLocaleString()} total players
          </div>
        </div>
        <PolicyLinks className="mt-3" />
      </div>
    </div>
  );
}
