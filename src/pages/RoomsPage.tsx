import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import RoomList from '../components/RoomList';
import Leaderboard from '../components/Leaderboard';
import AccountButtons from '../components/AccountButtons';
import type { RoomIndexEntry } from '../types';

/**
 * Main lobby: every active room in the game, plus the leaderboard.
 * The room card always fills the screen height (desktop: rooms left, leaderboard right;
 * phone: rooms fill the first screen, leaderboard below).
 */
export default function RoomsPage() {
  const navigate = useNavigate();

  const pick = (room: RoomIndexEntry) => navigate(`/join/${room.id}`, { state: { room } });
  const create = () => navigate('/', { state: { mode: 'create' } });

  return (
    <div className="min-h-dvh md:h-dvh bg-gradient-to-br from-brand-50 to-sky-100 p-4 flex flex-col">
      <div className="w-full max-w-5xl mx-auto flex-1 min-h-0 flex flex-col gap-4">
        <header className="flex items-center justify-between gap-2 pt-2">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden /> Home
          </button>
          <AccountButtons />
        </header>

        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-brand-600 tracking-tight">Main lobby</h1>
            <p className="text-sm text-gray-500">Every room in the game. Pick one to join.</p>
          </div>
          <button
            onClick={create}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-bold hover:bg-brand-600 transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden /> Create Room
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4">
          {/* Phone: at least the rest of the first screen; desktop: the full column height */}
          <div className="min-h-[calc(100dvh-11rem)] md:min-h-0 md:flex-1 flex flex-col">
            <RoomList onPick={pick} onCreate={create} />
          </div>
          <div className="md:w-96 md:flex-shrink-0 md:overflow-y-auto pb-2">
            <Leaderboard />
          </div>
        </div>
      </div>
    </div>
  );
}
