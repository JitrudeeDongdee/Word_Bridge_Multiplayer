/** One open tab of the game (`presence/{sessionId}`). Older clients only write joinedAt/device. */
export interface PresenceEntry {
  joinedAt: number;
  device?: 'mobile' | 'desktop';
  uid?: string;
  /** Display name at the time (members: account name; guests: the name they play under) */
  name?: string;
  member?: boolean;
  /** Room the tab is in (lobby, game or victory screen); absent elsewhere */
  roomId?: string;
}

export interface PersonProfile {
  name: string;
  photo?: string;
}

export interface Person {
  uid: string;
  name: string;
  photo?: string;
  member: boolean;
  /** Set when at least one of their tabs is in a room */
  roomId?: string;
}

export interface PlayerGroups {
  inGame: Person[];
  online: Person[];
  /** Members only — guests have no lasting profile, so they disappear when they leave */
  offline: Person[];
}

const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * Splits everyone into in a room / online / offline.
 * Several tabs of the same person count once; being in a room wins over just being online.
 * Sessions without a uid (old clients) are left out of the list — they still count in "online now".
 */
export function groupPlayers(
  sessions: PresenceEntry[],
  profiles: Record<string, PersonProfile>,
): PlayerGroups {
  const live = new Map<string, Person>();
  for (const s of sessions) {
    if (!s?.uid) continue;
    const prev = live.get(s.uid);
    const prof = profiles[s.uid];
    live.set(s.uid, {
      uid: s.uid,
      name: prof?.name || prev?.name || s.name?.trim() || 'Guest',
      photo: prof?.photo,
      member: Boolean(prof || s.member || prev?.member),
      roomId: prev?.roomId ?? (s.roomId || undefined),
    });
  }

  const inGame: Person[] = [];
  const online: Person[] = [];
  for (const p of live.values()) (p.roomId ? inGame : online).push(p);

  const offline: Person[] = Object.entries(profiles)
    .filter(([uid, prof]) => !live.has(uid) && prof?.name)
    .map(([uid, prof]) => ({ uid, name: prof.name, photo: prof.photo, member: true }));

  return { inGame: inGame.sort(byName), online: online.sort(byName), offline: offline.sort(byName) };
}

/** Room id from a route like /lobby/ABC123, /game/ABC123 or /victory/ABC123 */
export function roomIdFromPath(pathname: string): string | undefined {
  return /^\/(?:lobby|game|victory)\/([^/]+)/.exec(pathname)?.[1];
}
