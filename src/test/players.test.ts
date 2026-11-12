import { describe, expect, it } from 'vitest';
import { groupPlayers, roomIdFromPath, type PresenceEntry } from '../utils/players';

const s = (uid: string | undefined, extra: Partial<PresenceEntry> = {}): PresenceEntry => ({ joinedAt: 1, uid, ...extra });

describe('groupPlayers', () => {
  const profiles = {
    ann: { name: 'Ann', photo: 'data:image/jpeg;base64,x' },
    bob: { name: 'Bob' },
    cat: { name: 'cat' },
  };

  it('splits into in a room / online / offline members', () => {
    const g = groupPlayers([s('ann', { roomId: 'R1' }), s('bob'), s('g1', { name: 'Gina' })], profiles);
    expect(g.inGame.map((p) => p.uid)).toEqual(['ann']);
    expect(g.inGame[0].roomId).toBe('R1');
    expect(g.online.map((p) => p.name)).toEqual(['Bob', 'Gina']);
    expect(g.offline.map((p) => p.uid)).toEqual(['cat']);
  });

  it('counts several tabs once, and a tab in a room wins', () => {
    const g = groupPlayers([s('ann'), s('ann', { roomId: 'R2' }), s('ann')], profiles);
    expect(g.inGame).toHaveLength(1);
    expect(g.inGame[0].roomId).toBe('R2');
    expect(g.online).toHaveLength(0);
  });

  it('uses the profile name and photo for members, and marks guests', () => {
    const g = groupPlayers([s('ann', { name: 'old name' }), s('g1'), s('g2', { name: '  ' })], profiles);
    const ann = g.online.find((p) => p.uid === 'ann')!;
    expect(ann).toMatchObject({ name: 'Ann', member: true });
    expect(ann.photo).toBeDefined();
    expect(g.online.filter((p) => !p.member).map((p) => p.name)).toEqual(['Guest', 'Guest']);
  });

  it('leaves out sessions from old clients without a uid', () => {
    const g = groupPlayers([s(undefined), s(undefined, { name: 'x' })], {});
    expect(g.online).toHaveLength(0);
    expect(g.inGame).toHaveLength(0);
  });

  it('sorts names case-insensitively', () => {
    const g = groupPlayers([], profiles);
    expect(g.offline.map((p) => p.name)).toEqual(['Ann', 'Bob', 'cat']);
  });
});

describe('roomIdFromPath', () => {
  it('finds the room on room screens only', () => {
    expect(roomIdFromPath('/lobby/AB12CD')).toBe('AB12CD');
    expect(roomIdFromPath('/game/AB12CD')).toBe('AB12CD');
    expect(roomIdFromPath('/victory/AB12CD')).toBe('AB12CD');
    expect(roomIdFromPath('/join/AB12CD')).toBeUndefined();
    expect(roomIdFromPath('/rooms')).toBeUndefined();
    expect(roomIdFromPath('/')).toBeUndefined();
  });
});
