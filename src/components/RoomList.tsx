import { Lock, Plus, Search, SearchX, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { filterRooms, subscribeRoomIndex } from '../services/roomIndexService';
import type { RoomIndexEntry } from '../types';

const STATUS_LABEL: Record<RoomIndexEntry['status'], { text: string; className: string }> = {
  waiting: { text: 'Waiting', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  playing: { text: 'Playing', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  won: { text: 'Round over', className: 'bg-gray-50 text-gray-500 border-gray-200' },
};

interface RoomListProps {
  onPick: (room: RoomIndexEntry) => void;
  /** Shown as a button in the empty state */
  onCreate?: () => void;
}

/** Empty-state art: two word dots waiting for a bridge (vector, brand colours). */
function EmptyBridge() {
  return (
    <svg viewBox="0 0 200 120" className="w-44 h-auto" aria-hidden>
      <defs>
        <linearGradient id="eb-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e0f2fe" />
          <stop offset="1" stopColor="#bae6fd" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="104" rx="86" ry="10" fill="#e0f2fe" />
      <path d="M40 78 Q100 10 160 78" fill="none" stroke="#7dd3fc" strokeWidth="6" strokeLinecap="round" strokeDasharray="2 14" />
      <rect x="22" y="92" width="156" height="8" rx="4" fill="url(#eb-bg)" />
      <circle cx="40" cy="78" r="17" fill="#0ea5e9" />
      <circle cx="160" cy="78" r="17" fill="#0ea5e9" />
      <circle cx="100" cy="36" r="13" fill="#fff" stroke="#fde68a" strokeWidth="5" strokeDasharray="5 6" />
      <circle cx="40" cy="78" r="6" fill="#fff" />
      <circle cx="160" cy="78" r="6" fill="#fff" />
    </svg>
  );
}

/** Central lobby: every active room, live. */
export default function RoomList({ onPick, onCreate }: RoomListProps) {
  const [rooms, setRooms] = useState<RoomIndexEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const shown = rooms ? filterRooms(rooms, query) : null;

  useEffect(
    () =>
      subscribeRoomIndex(
        (entries) => {
          setRooms(entries);
          setFailed(false);
        },
        () => setFailed(true),
      ),
    [],
  );

  return (
    // Fills whatever height the page gives it; the list scrolls inside
    <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Rooms</h2>
        {rooms && (
          <span className="text-xs text-gray-400">
            {query.trim() && shown ? `${shown.length} of ${rooms.length}` : rooms.length} open
          </span>
        )}
      </div>

      <label className="relative">
        <span className="sr-only">Search rooms</span>
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by room name, host or code"
          className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 [&::-webkit-search-cancel-button]:hidden"
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        )}
      </label>

      {failed && <p className="text-xs text-red-500">Couldn't load the room list.</p>}
      {!failed && rooms === null && <p className="text-xs text-gray-400">Loading rooms…</p>}
      {!failed && rooms?.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-8">
          <EmptyBridge />
          <div>
            <p className="font-bold text-gray-700">No rooms right now</p>
            <p className="text-sm text-gray-400">Create one and invite your friends to play.</p>
          </div>
          {onCreate && (
            <button
              onClick={onCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-bold hover:bg-brand-600 transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden /> Create Room
            </button>
          )}
        </div>
      )}

      {rooms && rooms.length > 0 && shown?.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-8 text-gray-400">
          <SearchX className="w-10 h-10 text-gray-300" aria-hidden />
          <p className="text-sm">No rooms match “{query.trim()}”.</p>
        </div>
      )}

      {shown && shown.length > 0 && (
        <ul className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto -mx-1 px-1">
          {shown.map((r) => {
            const status = STATUS_LABEL[r.status];
            return (
              <li key={r.id}>
                <button
                  onClick={() => onPick(r)}
                  className="w-full text-left flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 hover:border-brand-300 hover:bg-brand-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm flex items-center gap-1 min-w-0">
                      {r.hasPassword && (
                        <Lock className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" aria-label="Password required" />
                      )}
                      <span className="truncate">{r.name}</span>
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      Host {r.hostName} · <span className="font-mono">{r.id}</span>
                    </p>
                  </div>
                  <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-gray-600" title="Players in the room">
                    <Users className="w-3.5 h-3.5" aria-hidden /> {r.playerCount}
                  </span>
                  <span className={`flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${status.className}`}>
                    {status.text}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
