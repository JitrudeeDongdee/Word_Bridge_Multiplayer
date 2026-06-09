import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createRoom, joinRoom } from '../services/roomService';
import { useGameStore } from '../store/useGameStore';

export default function HomePage() {
  const navigate = useNavigate();
  const setIdentity = useGameStore((s) => s.setIdentity);
  const setRoom = useGameStore((s) => s.setRoom);

  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      const { room, playerId } = await createRoom(name.trim());
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
      const result = await joinRoom(code.trim().toUpperCase(), name.trim());
      if (!result) {
        setError('Room not found.');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-sky-100 flex items-center justify-center p-4">
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
            </div>
          )}

          {mode === 'create' && (
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <h2 className="text-xl font-bold text-gray-800">Create a Room</h2>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-600">Your name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  maxLength={20}
                  autoFocus
                />
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
                onClick={() => { setMode('menu'); setError(null); }}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                ← Back
              </button>
            </form>
          )}

          {mode === 'join' && (
            <form onSubmit={handleJoin} className="flex flex-col gap-4">
              <h2 className="text-xl font-bold text-gray-800">Join a Room</h2>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-600">Your name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  maxLength={20}
                  autoFocus
                />
              </label>
              {!inviteRoomId && (
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
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading || !name.trim() || code.trim().length < 6}
                className="py-2.5 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Joining…' : 'Join Room'}
              </button>
              {!inviteRoomId && (
                <button
                  type="button"
                  onClick={() => { setMode('menu'); setError(null); }}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  ← Back
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
