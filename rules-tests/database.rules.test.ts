import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { get, ref, remove, runTransaction, set, update, push } from 'firebase/database';

let env: RulesTestEnvironment;
const HOUR = 3600_000;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-word-bridge',
    database: { rules: readFileSync('database.rules.json', 'utf8'), host: '127.0.0.1', port: 9000 },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearDatabase());

const db = (uid?: string) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).database();
const player = (id: string, name = id) => ({ id, name, isHost: false, joinedAt: 1 });
function roomData(hostId: string, others: string[] = [], extra: Record<string, unknown> = {}) {
  const players: Record<string, unknown> = { [hostId]: { ...player(hostId), isHost: true } };
  for (const o of others) players[o] = player(o);
  return { id: 'R1', hostId, status: 'waiting', createdAt: Date.now(), lastActiveAt: Date.now(), players, ...extra };
}
/** Seed data with rules off */
const seed = (path: string, value: unknown) => env.withSecurityRulesDisabled((c) => set(ref(c.database(), path), value));

describe('signed-out clients', () => {
  it('can read and write nothing', async () => {
    await seed('rooms/R1', roomData('host'));
    await assertFails(get(ref(db(), 'rooms')));
    await assertFails(get(ref(db(), 'roomIndex')));
    await assertFails(set(ref(db(), 'rooms/R2'), roomData('x')));
    await assertFails(set(ref(db(), 'presence/s1'), { joinedAt: 1 }));
  });
});

describe('rooms', () => {
  it('a user can create a room they host, but not one hosted by someone else', async () => {
    await assertSucceeds(set(ref(db('host'), 'rooms/R1'), roomData('host')));
    await assertFails(set(ref(db('mallory'), 'rooms/R2'), roomData('host')));
  });

  it('signed-in users can read rooms (join flow, cleanup)', async () => {
    await seed('rooms/R1', roomData('host'));
    await assertSucceeds(get(ref(db('stranger'), 'rooms')));
  });

  it('joining: you can add yourself, not someone else', async () => {
    await seed('rooms/R1', roomData('host'));
    await assertSucceeds(update(ref(db('alice'), 'rooms/R1/players'), { alice: player('alice') }));
    // an outsider can't add someone else (members are trusted inside their room)
    await assertFails(update(ref(db('carol'), 'rooms/R1/players'), { bob: player('bob') }));
    await assertFails(set(ref(db('carol'), 'rooms/R1/players/carol'), { id: 'bob', name: 'x' })); // id must match
    // a seat may carry the member's avatar, as a small image data URL only
    await assertSucceeds(update(ref(db('alice'), 'rooms/R1/players/alice'), { photo: 'data:image/jpeg;base64,AAAA' }));
    await assertFails(update(ref(db('alice'), 'rooms/R1/players/alice'), { photo: 'javascript:alert(1)' }));
    await assertFails(update(ref(db('alice'), 'rooms/R1/players/alice'), { photo: 'data:image/jpeg;base64,' + 'A'.repeat(70000) }));
    await assertFails(set(ref(db('alice'), 'rooms/R9/players/alice'), player('alice'))); // room doesn't exist
  });

  it('members can play (nodes, edges, game state); outsiders cannot', async () => {
    await seed('rooms/R1', roomData('host', ['alice']));
    await assertSucceeds(set(ref(db('alice'), 'rooms/R1/nodes/n1'), { id: 'n1', word: 'fire', x: 1, y: 2 }));
    await assertSucceeds(update(ref(db('host'), 'rooms/R1'), { status: 'playing', lastActiveAt: Date.now() }));
    await assertFails(set(ref(db('mallory'), 'rooms/R1/nodes/n2'), { id: 'n2', word: 'evil' }));
    await assertFails(update(ref(db('mallory'), 'rooms/R1'), { status: 'won' }));
  });

  it('a member cannot take over as host; the leaving host can hand it over', async () => {
    await seed('rooms/R1', roomData('host', ['alice', 'bob']));
    await assertFails(update(ref(db('alice'), 'rooms/R1'), { hostId: 'alice' }));
    // leaveRoom(): remove yourself + pass hostId on, in one multi-path update
    await assertSucceeds(update(ref(db('host')), {
      'rooms/R1/players/host': null,
      'rooms/R1/hostId': 'alice',
      'rooms/R1/players/alice/isHost': true,
    }));
  });

  it('a member can leave; the host can kick', async () => {
    await seed('rooms/R1', roomData('host', ['alice', 'bob']));
    await assertSucceeds(remove(ref(db('alice'), 'rooms/R1/players/alice')));
    await assertSucceeds(remove(ref(db('host'), 'rooms/R1/players/bob')));
  });

  it('deleting a room: host yes, other members no, last player leaving yes', async () => {
    await seed('rooms/R1', roomData('host', ['alice']));
    await assertFails(remove(ref(db('alice'), 'rooms/R1')));
    await assertSucceeds(remove(ref(db('host'), 'rooms/R1')));
    // last player leaving (leaveRoom): remove yourself, then the now-empty room
    await seed('rooms/R2', roomData('host', ['solo']));
    await seed('rooms/R2/players/host', null);
    await assertSucceeds(remove(ref(db('solo'), 'rooms/R2/players/solo')));
    await assertSucceeds(remove(ref(db('solo'), 'rooms/R2')));
  });

  it('anyone signed in can clear out stale rooms, not active ones', async () => {
    await seed('rooms/OLD', roomData('host', [], { lastActiveAt: Date.now() - 3 * HOUR }));
    await seed('rooms/WON', roomData('host', [], { status: 'won', lastActiveAt: Date.now() - HOUR }));
    await seed('rooms/LIVE', roomData('host'));
    await assertSucceeds(remove(ref(db('stranger'), 'rooms/OLD')));
    await assertSucceeds(remove(ref(db('stranger'), 'rooms/WON')));
    await assertFails(remove(ref(db('stranger'), 'rooms/LIVE')));
  });

  it('chat: members post as themselves only', async () => {
    await seed('rooms/R1', roomData('host', ['alice']));
    await assertSucceeds(push(ref(db('alice'), 'rooms/R1/chat'), { playerId: 'alice', playerName: 'alice', text: 'hi', sentAt: 1 }));
    await assertFails(push(ref(db('alice'), 'rooms/R1/chat'), { playerId: 'host', playerName: 'host', text: 'fake', sentAt: 1 }));
    await assertFails(push(ref(db('mallory'), 'rooms/R1/chat'), { playerId: 'mallory', playerName: 'm', text: 'spam', sentAt: 1 }));
  });
});

describe('users', () => {
  it('a user reads and writes only their own profile', async () => {
    await assertSucceeds(set(ref(db('alice'), 'users/alice'), { name: 'Alice', createdAt: 1 }));
    await assertSucceeds(get(ref(db('alice'), 'users/alice')));
    await assertFails(get(ref(db('bob'), 'users/alice')));
    await assertFails(set(ref(db('bob'), 'users/alice'), { name: 'Hacked' }));
    await assertFails(set(ref(db('alice'), 'users/alice'), { name: '' }));
    // avatar: a small image data URL only
    await assertSucceeds(update(ref(db('alice'), 'users/alice'), { photo: 'data:image/jpeg;base64,AAAA' }));
    await assertFails(update(ref(db('alice'), 'users/alice'), { photo: 'https://evil.example/x.png' }));
    await assertFails(update(ref(db('alice'), 'users/alice'), { photo: 'data:image/jpeg;base64,' + 'A'.repeat(70000) }));
    await assertSucceeds(update(ref(db('alice'), 'users/alice'), { photo: null }));
  });
});

describe('leaderboard', () => {
  const round = (over: Record<string, unknown> = {}) => ({ roomId: 'R1', at: Date.now(), scores: { host: 12, alice: 5 }, names: { host: 'H', alice: 'A' }, crowns: { host: true }, ...over });
  it('a room member logs a finished round once; outsiders and replays are refused', async () => {
    await seed('rooms/R1', roomData('host', ['alice']));
    await assertFails(set(ref(db('mallory'), 'winLog/R1_1'), round()));
    await assertSucceeds(set(ref(db('host'), 'winLog/R1_1'), round()));
    await assertFails(set(ref(db('alice'), 'winLog/R1_1'), round({ scores: { alice: 99 }, crowns: { alice: true } })));
    await assertSucceeds(get(ref(db('stranger'), 'winLog')));
    await assertFails(get(ref(db(), 'winLog')));
  });
  it('rejects forged rounds: wrong key, old timestamp, silly scores, crown without a score', async () => {
    await seed('rooms/R1', roomData('host', ['alice']));
    await assertFails(set(ref(db('host'), 'winLog/OTHER_1'), round()));
    await assertFails(set(ref(db('host'), 'winLog/R1_2'), round({ at: Date.now() - 3600_000 })));
    await assertFails(set(ref(db('host'), 'winLog/R1_3'), round({ scores: { host: 1000 } })));
    await assertFails(set(ref(db('host'), 'winLog/R1_4'), round({ crowns: { bob: true } })));
  });
  it('public profiles: anyone signed in reads, only the owner writes', async () => {
    await assertSucceeds(set(ref(db('alice'), 'publicProfiles/alice'), { name: 'Alice', photo: 'data:image/jpeg;base64,AA' }));
    await assertSucceeds(get(ref(db('bob'), 'publicProfiles/alice')));
    await assertFails(set(ref(db('bob'), 'publicProfiles/alice'), { name: 'Hacked' }));
    await assertFails(update(ref(db('alice'), 'publicProfiles/alice'), { photo: 'https://x/y.png' }));
    // "Delete my data" removes it; nobody else can
    await assertFails(remove(ref(db('bob'), 'publicProfiles/alice')));
    await assertSucceeds(remove(ref(db('alice'), 'publicProfiles/alice')));
  });
});

describe('shared data', () => {
  it('room index, presence and the player counter', async () => {
    const entry = { id: 'R1', name: 'x', hostName: 'h', playerCount: 1, status: 'waiting', hasPassword: false, lastActiveAt: 1 };
    await assertSucceeds(set(ref(db('a'), 'roomIndex/R1'), entry));
    await assertFails(set(ref(db('a'), 'roomIndex/R1'), { ...entry, id: 'OTHER' }));
    await assertSucceeds(remove(ref(db('a'), 'roomIndex/R1')));
    await assertSucceeds(set(ref(db('a'), 'presence/s1'), { joinedAt: 1, device: 'desktop' }));
    await assertSucceeds(runTransaction(ref(db('a'), 'stats/totalPlayers'), (n) => (n ?? 0) + 1));
    await assertFails(set(ref(db('a'), 'stats/totalPlayers'), 999999));
  });

  it('votes, learned pairs and custom words', async () => {
    await assertSucceeds(update(ref(db('alice'), 'pairVotes/fire|snow'), { a: 'fire', b: 'snow', 'voters/p_alice': { playerId: 'alice', at: 1 } }));
    await assertFails(update(ref(db('alice'), 'pairVotes/fire|snow'), { 'voters/p_bob': { playerId: 'bob', at: 1 } }));
    await assertSucceeds(set(ref(db('alice'), 'learnedPairs/fire|snow'), true));
    await assertFails(set(ref(db('alice'), 'learnedPairs/fire|snow'), 'yes'));
    await assertSucceeds(set(ref(db('alice'), 'globalCustomWords/zorb'), { word: 'zorb' }));
    await assertFails(set(ref(db('alice'), 'globalCustomWords/zorb'), { word: 'other' }));
  });
});
