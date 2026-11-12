import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, DoorOpen, Plus, Trophy, Users } from 'lucide-react';
import RoomList from '../components/RoomList';
import Leaderboard from '../components/Leaderboard';
import PlayersPanel from '../components/PlayersPanel';
import AccountButtons from '../components/AccountButtons';
import type { RoomIndexEntry } from '../types';

type Tab = 'rooms' | 'leaderboard' | 'players';
const TABS: { id: Tab; label: string; Icon: typeof Users }[] = [
  { id: 'rooms', label: 'Rooms', Icon: DoorOpen },
  { id: 'leaderboard', label: 'Leaderboard', Icon: Trophy },
  { id: 'players', label: 'Players', Icon: Users },
];

/**
 * Main lobby: every active room in the game, the leaderboard and the player list.
 * Desktop: rooms left; leaderboard (top 3 + you) and the player list share the right column,
 * all filling the screen height. Phone: one tab at a time (Rooms / Leaderboard / Players).
 */
export default function RoomsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('rooms');

  const pick = (room: RoomIndexEntry) => navigate(`/join/${room.id}`, { state: { room } });
  const create = () => navigate('/', { state: { mode: 'create' } });
  // Phone: only the chosen tab; desktop (md+): everything
  const shownOnPhone = (id: Tab) => (tab === id ? 'flex' : 'hidden md:flex');

  return (
    <div className="h-dvh bg-gradient-to-br from-brand-50 to-sky-100 p-4 flex flex-col">
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

        <div role="tablist" aria-label="Main lobby sections" className="md:hidden grid grid-cols-3 rounded-xl bg-white/70 p-1 text-xs font-semibold shadow-sm">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors ${tab === id ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'}`}
            >
              <Icon className="w-4 h-4" aria-hidden /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4">
          <div className={`${shownOnPhone('rooms')} flex-1 min-h-0 flex-col`}>
            <RoomList onPick={pick} onCreate={create} />
          </div>
          {/* Leaderboard takes what it needs, the player list fills the rest and scrolls */}
          <div className={`${tab === 'rooms' ? 'hidden md:flex' : 'flex'} flex-1 md:flex-none md:w-96 md:flex-shrink-0 min-h-0 flex-col gap-4`}>
            <div className={`${shownOnPhone('leaderboard')} flex-col flex-shrink-0 min-h-0 overflow-y-auto`}>
              <Leaderboard />
            </div>
            <div className={`${shownOnPhone('players')} flex-1 min-h-0 flex-col md:pb-2`}>
              <PlayersPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
