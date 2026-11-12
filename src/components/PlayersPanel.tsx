import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import Avatar from './Avatar';
import { usePresenceSessions } from '../hooks/usePresence';
import { subscribePublicProfiles, type PublicProfile } from '../services/leaderboardService';
import { subscribeRoomIndex } from '../services/roomIndexService';
import { useAuthStore } from '../store/useAuthStore';
import { groupPlayers, type Person } from '../utils/players';
import type { RoomIndexEntry } from '../types';

/** Offline members shown before "Show all" */
const OFFLINE_PREVIEW = 8;

const SECTIONS = [
  { key: 'inGame', label: 'In a room', dot: 'bg-amber-400' },
  { key: 'online', label: 'Online', dot: 'bg-emerald-500' },
  { key: 'offline', label: 'Offline', dot: 'bg-gray-300' },
] as const;

/**
 * Everyone in the game, under the leaderboard: in a room / online / offline.
 * Offline lists members only (guests have no lasting profile).
 */
export default function PlayersPanel() {
  const navigate = useNavigate();
  const sessions = usePresenceSessions();
  const [profiles, setProfiles] = useState<Record<string, PublicProfile> | null>(null);
  const [rooms, setRooms] = useState<Record<string, RoomIndexEntry>>({});
  const [showAllOffline, setShowAllOffline] = useState(false);
  const myUid = useAuthStore((s) => s.user?.uid ?? null);

  useEffect(() => subscribePublicProfiles(setProfiles), []);
  useEffect(
    () => subscribeRoomIndex((entries) => setRooms(Object.fromEntries(entries.map((e) => [e.id, e])))),
    [],
  );

  const groups = useMemo(
    () => (sessions && profiles ? groupPlayers(sessions, profiles) : null),
    [sessions, profiles],
  );

  const row = (p: Person, status: (typeof SECTIONS)[number]) => {
    const me = p.uid === myUid;
    const room = p.roomId ? rooms[p.roomId] : undefined;
    return (
      <li key={p.uid} className={`flex items-center gap-3 px-3 py-1.5 rounded-xl ${me ? 'bg-brand-50 ring-1 ring-brand-200' : ''}`}>
        <span className="relative flex-shrink-0">
          <Avatar name={p.name} photo={p.photo} size={28} />
          <span aria-hidden className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${status.dot}`} />
        </span>
        <span className={`flex-1 min-w-0 truncate text-sm font-semibold ${status.key === 'offline' ? 'text-gray-400' : 'text-gray-800'}`}>
          {p.name}
          {me && <span className="ml-1 text-xs font-normal text-gray-400">(you)</span>}
          {!p.member && <span className="ml-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">guest</span>}
        </span>
        {room && !me && (
          <button
            onClick={() => navigate(`/join/${room.id}`, { state: { room } })}
            className="max-w-[45%] truncate text-xs text-brand-600 hover:underline"
            title={`Join ${room.name}`}
          >
            {room.name}
          </button>
        )}
        {room && me && <span className="max-w-[45%] truncate text-xs text-gray-400">{room.name}</span>}
      </li>
    );
  };

  return (
    <section className="flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col gap-3" aria-label="Players">
      <h2 className="flex-shrink-0 text-lg font-black text-gray-800 inline-flex items-center gap-2">
        <Users className="w-5 h-5 text-brand-500" aria-hidden /> Players
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-3 -mx-1 px-1">

      {!groups ? (
        <p className="text-sm text-gray-400 text-center py-4">Loading…</p>
      ) : (
        SECTIONS.map((s) => {
          const all = groups[s.key];
          const list = s.key === 'offline' && !showAllOffline ? all.slice(0, OFFLINE_PREVIEW) : all;
          return (
            <div key={s.key} className="flex flex-col gap-0.5">
              <h3 className="px-3 text-xs font-bold uppercase tracking-wide text-gray-500 inline-flex items-center gap-1.5">
                <span aria-hidden className={`w-2 h-2 rounded-full ${s.dot}`} /> {s.label}
                <span className="font-normal text-gray-400 tabular-nums">({all.length})</span>
              </h3>
              {all.length === 0 ? (
                <p className="px-3 py-1 text-xs text-gray-400">Nobody right now</p>
              ) : (
                <ul className="flex flex-col gap-0.5">{list.map((p) => row(p, s))}</ul>
              )}
              {s.key === 'offline' && all.length > OFFLINE_PREVIEW && (
                <button
                  onClick={() => setShowAllOffline((v) => !v)}
                  className="self-start px-3 py-1 text-xs font-semibold text-brand-600 hover:underline"
                >
                  {showAllOffline ? 'Show less' : `Show all ${all.length}`}
                </button>
              )}
            </div>
          );
        })
      )}
      </div>
      <p className="flex-shrink-0 text-[11px] text-gray-400">Offline lists members only — guests show up while they are online.</p>
    </section>
  );
}
