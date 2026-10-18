import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinRoom } from '../services/roomService';
import { joinErrorMessage } from '../services/roomIndexService';
import { useGameStore } from '../store/useGameStore';
import { useAuthStore } from '../store/useAuthStore';
import type { Room } from '../types';

const ADJ = ['Swift', 'Bright', 'Clever', 'Bold', 'Quick', 'Sharp', 'Witty', 'Calm'];
const NOUN = ['Fox', 'Owl', 'Lynx', 'Wolf', 'Hawk', 'Bear', 'Deer', 'Crow'];
function randomName() {
  return ADJ[Math.floor(Math.random() * ADJ.length)] + NOUN[Math.floor(Math.random() * NOUN.length)];
}

interface JoinGameFormProps {
  roomId: string;
  onJoined: (playerId: string, name: string, room: Room) => void;
}

export default function JoinGameForm({ roomId, onJoined }: JoinGameFormProps) {
  const navigate = useNavigate();
  const setIdentity = useGameStore((s) => s.setIdentity);
  const setRoom = useGameStore((s) => s.setRoom);
  // A member plays under their account name; a guest gets their last name back, or a random one
  const startName = useAuthStore((s) => s.memberName) ?? useGameStore.getState().playerName;
  const [joinName, setJoinName] = useState(() => startName || randomName());
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  // Shown once the room turns out to be locked
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!joinName.trim()) return;
    setJoining(true);
    setJoinError(null);
    try {
      const result = await joinRoom(roomId, joinName.trim(), undefined, password || undefined);
      if (!result.ok) {
        if (result.reason !== 'not_found') setNeedsPassword(true);
        setJoinError(joinErrorMessage(result.reason));
        setJoining(false);
        return;
      }
      setIdentity(result.playerId, joinName.trim());
      setRoom(result.room);
      onJoined(result.playerId, joinName.trim(), result.room);
    } catch {
      setJoinError('Failed to join. Check your connection.');
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-sky-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-brand-600 tracking-tight">Word Bridge</h1>
          <p className="mt-2 text-gray-500 text-sm">A game is in progress</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Join Game</h2>
              <p className="text-xs text-gray-500 mt-1">
                Room <span className="font-mono font-bold tracking-wider">{roomId}</span>
              </p>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Your name</span>
              <input
                type="text"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Enter your name"
                className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                maxLength={20}
                autoFocus
                disabled={joining}
                inputMode="text"
                enterKeyHint="go"
              />
            </label>
            {needsPassword && (
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-600 inline-flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" aria-hidden /> Room password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ask the host"
                  className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  maxLength={40}
                  autoFocus
                  disabled={joining}
                />
              </label>
            )}
            {joinError && <p className="text-red-500 text-xs">{joinError}</p>}
            <button
              type="submit"
              disabled={joining || !joinName.trim()}
              className="w-full py-3 rounded-xl bg-brand-500 text-white font-bold text-lg hover:bg-brand-600 disabled:opacity-60 transition-colors"
            >
              {joining ? 'Joining…' : <span className="inline-flex items-center gap-1.5">Join Game <ArrowRight className="w-5 h-5" aria-hidden /></span>}
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors text-center"
            >
              <span className="inline-flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" aria-hidden /> Back to home</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
