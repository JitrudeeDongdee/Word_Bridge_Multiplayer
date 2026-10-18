import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashRoomPassword, checkRoomPassword, newPasswordSalt } from '../utils/roomPassword';
import { toIndexEntry, sortRoomList, filterRooms, ROOM_LIST_MAX_IDLE_MS } from '../services/roomIndexService';
import type { Room, RoomIndexEntry } from '../types';

// In-memory stand-in for the Realtime Database
const store: Record<string, unknown> = {};
vi.mock('../services/firebase', () => ({ db: {}, auth: { currentUser: null } }));
vi.mock('firebase/database', () => ({
  ref: (_db: unknown, path?: string) => path ?? '',
  get: async (path: string) => ({ exists: () => store[path] !== undefined, val: () => store[path] ?? null }),
  set: async (path: string, v: unknown) => { store[path] = v; },
  remove: async (path: string) => { delete store[path]; },
  update: async (path: string, values: Record<string, unknown>) => {
    const target = (store[path] ?? {}) as Record<string, unknown>;
    store[path] = { ...target, ...values };
  },
  onValue: vi.fn(),
  serverTimestamp: () => 0,
}));

const room = (over: Partial<Room> = {}): Room => ({
  id: 'ABC123', hostId: 'h', createdAt: 1, lastActiveAt: 1000, status: 'waiting',
  players: { h: { id: 'h', name: 'BoldFox', isHost: true, joinedAt: 1 } },
  nodes: {}, edges: {}, gameState: null, winnerId: null, winningPath: null,
  lastWordScores: null, scores: {}, roundScores: null, ...over,
});

describe('room passwords', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const salt = newPasswordSalt();
    const hash = await hashRoomPassword('secret', salt);
    expect(hash).not.toContain('secret');
    expect(await checkRoomPassword('secret', salt, hash)).toBe(true);
    expect(await checkRoomPassword('Secret', salt, hash)).toBe(false);
  });

  it('gives the same password a different hash in each room (salted)', async () => {
    expect(await hashRoomPassword('1234', newPasswordSalt())).not.toBe(await hashRoomPassword('1234', newPasswordSalt()));
  });
});

describe('room index', () => {
  it('summarises a room without exposing the password', () => {
    const e = toIndexEntry(room({ passwordHash: 'x', passwordSalt: 'y', players: {
      h: { id: 'h', name: 'BoldFox', isHost: true, joinedAt: 1 },
      p: { id: 'p', name: 'QuickOwl', isHost: false, joinedAt: 2 },
    } }));
    expect(e).toEqual({ id: 'ABC123', name: "BoldFox's room", hostName: 'BoldFox', playerCount: 2, status: 'waiting', hasPassword: true, lastActiveAt: 1000 });
    expect(JSON.stringify(e)).not.toMatch(/passwordHash|passwordSalt/);
  });

  it('uses the host-chosen name when set', () => {
    expect(toIndexEntry(room({ name: 'Friday crew' })).name).toBe('Friday crew');
  });

  it('lists waiting rooms first, then by recent activity, hiding empty and idle rooms', () => {
    const now = 10_000_000;
    const e = (id: string, status: RoomIndexEntry['status'], ago: number, playerCount = 1): RoomIndexEntry =>
      ({ id, name: id, hostName: '', playerCount, status, hasPassword: false, lastActiveAt: now - ago });
    const sorted = sortRoomList([
      e('playing-new', 'playing', 10), e('waiting-old', 'waiting', 500), e('waiting-new', 'waiting', 5),
      e('idle', 'waiting', ROOM_LIST_MAX_IDLE_MS + 1), e('empty', 'waiting', 1, 0),
    ], now);
    expect(sorted.map((r) => r.id)).toEqual(['waiting-new', 'waiting-old', 'playing-new']);
  });
});

describe('filterRooms', () => {
  const e = (id: string, name: string, hostName: string): RoomIndexEntry =>
    ({ id, name, hostName, playerCount: 1, status: 'waiting', hasPassword: false, lastActiveAt: 0 });
  const rooms = [e('ABC123', 'Friday crew', 'BoldFox'), e('XYZ789', 'ห้องเพื่อน ม.6', 'QuickOwl'), e('QQQ111', "cookie's room", 'cookie')];

  it('matches room name, host name and room code, ignoring case and spaces', () => {
    expect(filterRooms(rooms, 'friday').map((r) => r.id)).toEqual(['ABC123']);
    expect(filterRooms(rooms, '  quickowl ').map((r) => r.id)).toEqual(['XYZ789']);
    expect(filterRooms(rooms, 'qqq1').map((r) => r.id)).toEqual(['QQQ111']);
    expect(filterRooms(rooms, 'ห้องเพื่อน').map((r) => r.id)).toEqual(['XYZ789']);
  });

  it('returns everything for an empty query and nothing for no match', () => {
    expect(filterRooms(rooms, '')).toHaveLength(3);
    expect(filterRooms(rooms, 'zzz')).toEqual([]);
  });
});

describe('joinRoom', () => {
  beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

  it('asks for the password, rejects a wrong one, and lets the right one in', async () => {
    const { joinRoom } = await import('../services/roomService');
    const salt = newPasswordSalt();
    store['rooms/ABC123'] = room({ passwordSalt: salt, passwordHash: await hashRoomPassword('open sesame', salt) });

    expect(await joinRoom('ABC123', 'QuickOwl')).toEqual({ ok: false, reason: 'password_required' });
    expect(await joinRoom('ABC123', 'QuickOwl', undefined, 'nope')).toEqual({ ok: false, reason: 'wrong_password' });
    const ok = await joinRoom('ABC123', 'QuickOwl', undefined, 'open sesame');
    expect(ok.ok).toBe(true);
    // the public summary was refreshed with the new player
    expect((store['roomIndex/ABC123'] as RoomIndexEntry).hasPassword).toBe(true);
  });

  it('joins open rooms without a password, and rooms between rounds as a spectator', async () => {
    const { joinRoom } = await import('../services/roomService');
    store['rooms/ABC123'] = room({ status: 'won' });
    const res = await joinRoom('ABC123', 'QuickOwl');
    expect(res.ok && res.room.players[res.playerId].spectator).toBe(true);
    expect(await joinRoom('NOPE00', 'QuickOwl')).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('updateRoomSettings', () => {
  beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

  it('lets the host replace a forgotten password without the old one', async () => {
    const { updateRoomSettings, joinRoom } = await import('../services/roomService');
    const salt = newPasswordSalt();
    store['rooms/ABC123'] = room({ passwordSalt: salt, passwordHash: await hashRoomPassword('forgotten', salt) });

    await updateRoomSettings('ABC123', { password: 'fresh' });

    expect(await joinRoom('ABC123', 'P1', undefined, 'forgotten')).toEqual({ ok: false, reason: 'wrong_password' });
    expect((await joinRoom('ABC123', 'P2', undefined, 'fresh')).ok).toBe(true);
    expect(JSON.stringify(store['rooms/ABC123'])).not.toContain('fresh');
  });

  it('removes the lock and renames the room (empty name = default)', async () => {
    const { updateRoomSettings, joinRoom } = await import('../services/roomService');
    const salt = newPasswordSalt();
    store['rooms/ABC123'] = room({ name: 'Old', passwordSalt: salt, passwordHash: await hashRoomPassword('x', salt) });

    await updateRoomSettings('ABC123', { password: null, name: '  Friday crew  ' });
    expect((store['roomIndex/ABC123'] as RoomIndexEntry)).toMatchObject({ name: 'Friday crew', hasPassword: false });
    expect((await joinRoom('ABC123', 'P1')).ok).toBe(true);

    await updateRoomSettings('ABC123', { name: '' });
    expect((store['roomIndex/ABC123'] as RoomIndexEntry).name).toBe("BoldFox's room");
  });
});
