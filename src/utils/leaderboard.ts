/** One finished round, as logged in winLog/{roomId}_{startedAt}. */
export interface WinLogEntry {
  roomId: string;
  at: number;
  /** Points each player scored in the round */
  scores: Record<string, number>;
  /** Display name of each player at the time */
  names?: Record<string, string>;
  /** Players who earned the round's crown (top score; ties share it) */
  crowns?: Record<string, true>;
}

export interface LeaderRow {
  uid: string;
  name: string;
  crowns: number;
  points: number;
}

export type Period = 'week' | 'month' | 'all';

/** Game time is Thailand time (UTC+7, no DST): weeks start Monday 00:00, months on the 1st. */
const ICT_OFFSET_MS = 7 * 3600_000;

export function periodStart(period: Period, now = Date.now()): number {
  if (period === 'all') return 0;
  const ict = new Date(now + ICT_OFFSET_MS); // read the UTC fields as Thai wall-clock time
  const y = ict.getUTCFullYear(), m = ict.getUTCMonth(), d = ict.getUTCDate();
  if (period === 'month') return Date.UTC(y, m, 1) - ICT_OFFSET_MS;
  const daysSinceMonday = (ict.getUTCDay() + 6) % 7;
  return Date.UTC(y, m, d - daysSinceMonday) - ICT_OFFSET_MS;
}

/** Players who should get the crown for a round: the top scorer(s), if anyone scored. */
export function roundCrowns(scores: Record<string, number>): string[] {
  const best = Math.max(0, ...Object.values(scores));
  if (best <= 0) return [];
  return Object.entries(scores).filter(([, pts]) => pts === best).map(([uid]) => uid);
}

/** Sum crowns and points per player since `since`; ranked by crowns, then points. */
export function aggregate(entries: WinLogEntry[], since = 0): LeaderRow[] {
  const rows = new Map<string, LeaderRow & { lastAt: number }>();
  for (const e of entries) {
    if (!e || typeof e.at !== 'number' || e.at < since) continue;
    for (const [uid, pts] of Object.entries(e.scores ?? {})) {
      const row = rows.get(uid) ?? { uid, name: 'Player', crowns: 0, points: 0, lastAt: -1 };
      row.points = Math.round((row.points + (Number(pts) || 0)) * 10) / 10;
      if (e.crowns?.[uid]) row.crowns += 1;
      // Show the name they used most recently
      if (e.at >= row.lastAt && e.names?.[uid]) { row.name = e.names[uid]; row.lastAt = e.at; }
      rows.set(uid, row);
    }
  }
  return [...rows.values()]
    .map(({ uid, name, crowns, points }) => ({ uid, name, crowns, points }))
    .sort((a, b) => b.crowns - a.crowns || b.points - a.points || a.name.localeCompare(b.name));
}
