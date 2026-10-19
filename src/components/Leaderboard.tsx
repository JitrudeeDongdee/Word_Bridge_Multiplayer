import { useEffect, useMemo, useState } from 'react';
import { Crown, MoreHorizontal, Trophy } from 'lucide-react';
import Avatar from './Avatar';
import { aggregate, periodStart, type LeaderRow, type Period, type WinLogEntry } from '../utils/leaderboard';
import { loadPublicProfiles, subscribeRounds, type PublicProfile } from '../services/leaderboardService';
import { useAuthStore } from '../store/useAuthStore';

const TABS: { id: Period; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
];
const TOP = 10;
const RANK_COLORS = ['text-amber-500', 'text-slate-400', 'text-orange-400'];

/**
 * Crowns = rounds won (top score of the round, ties share), across every room.
 * Ranked by crowns, then total points. Guests count too (their browser's player id).
 */
export default function Leaderboard() {
  const [period, setPeriod] = useState<Period>('week');
  // Rounds are tagged with the period they were loaded for, so switching tabs shows "Loading…"
  const [loaded, setLoaded] = useState<{ period: Period; rounds: WinLogEntry[] } | null>(null);
  const rounds = loaded?.period === period ? loaded.rounds : null;
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const myUid = useAuthStore((s) => s.user?.uid ?? null);

  useEffect(() => subscribeRounds(periodStart(period), (r) => setLoaded({ period, rounds: r })), [period]);

  const rows = useMemo(() => (rounds ? aggregate(rounds, periodStart(period)) : []), [rounds, period]);
  const top = rows.slice(0, TOP);
  const myIndex = myUid ? rows.findIndex((r) => r.uid === myUid) : -1;

  // Pictures/current names of the people shown (members who set one)
  const shownKey = [...top.map((r) => r.uid), myIndex >= TOP ? myUid : ''].join(',');
  useEffect(() => {
    const uids = shownKey.split(',').filter((u) => u && !(u in profiles));
    if (uids.length) loadPublicProfiles(uids).then((p) => setProfiles((prev) => ({ ...prev, ...p })));
  }, [shownKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const row = (r: LeaderRow, rank: number) => {
    const me = r.uid === myUid;
    const prof = profiles[r.uid];
    const name = prof?.name ?? r.name;
    return (
      <li key={r.uid} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${me ? 'bg-brand-50 ring-1 ring-brand-200' : ''}`}>
        <span className={`w-6 text-center text-sm font-black tabular-nums ${RANK_COLORS[rank - 1] ?? 'text-gray-400'}`}>{rank}</span>
        <Avatar name={name} photo={prof?.photo} size={28} />
        <span className="flex-1 min-w-0 truncate text-sm font-semibold text-gray-800">
          {name}{me && <span className="ml-1 text-xs font-normal text-gray-400">(you)</span>}
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-black text-amber-500 tabular-nums" title={`${r.crowns} round${r.crowns === 1 ? '' : 's'} won`}>
          <Crown className="w-4 h-4" fill="currentColor" aria-label="crowns" /> {r.crowns}
        </span>
        <span className="w-16 text-right text-xs text-gray-400 tabular-nums">{r.points} pts</span>
      </li>
    );
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col gap-3" aria-label="Leaderboard">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-black text-gray-800 inline-flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" aria-hidden /> Leaderboard
        </h2>
        <div role="tablist" className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs font-semibold">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={period === t.id}
              onClick={() => setPeriod(t.id)}
              className={`px-2.5 py-1 rounded-md transition-colors ${period === t.id ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {rounds === null ? (
        <p className="text-sm text-gray-400 text-center py-4">Loading…</p>
      ) : top.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No rounds won yet {period === 'all' ? '' : `this ${period}`} — be the first!</p>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {top.map((r, i) => row(r, i + 1))}
          {myIndex >= TOP && (
            <>
              <li aria-hidden className="flex justify-center text-gray-300"><MoreHorizontal className="w-4 h-4" /></li>
              {row(rows[myIndex], myIndex + 1)}
            </>
          )}
        </ol>
      )}
      <p className="text-[11px] text-gray-400">
        <Crown className="inline w-3 h-3 -mt-0.5 text-amber-500" fill="currentColor" aria-hidden /> = rounds won (top score of the round). Ties on crowns go to total points. Weeks start Monday, Thai time.
      </p>
    </section>
  );
}
