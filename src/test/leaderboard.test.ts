import { describe, it, expect } from 'vitest';
import { aggregate, periodStart, roundCrowns, type WinLogEntry } from '../utils/leaderboard';

// 2026-10-21 is a Wednesday
const ict = (iso: string) => Date.parse(iso + '+07:00');

describe('periodStart (Thai time)', () => {
  const now = ict('2026-10-21T10:30:00');
  it('week starts Monday 00:00 ICT', () => expect(periodStart('week', now)).toBe(ict('2026-10-19T00:00:00')));
  it('month starts on the 1st 00:00 ICT', () => expect(periodStart('month', now)).toBe(ict('2026-10-01T00:00:00')));
  it('all time starts at 0', () => expect(periodStart('all', now)).toBe(0));
  it('Sunday night still belongs to the week that began on Monday', () =>
    expect(periodStart('week', ict('2026-10-25T23:59:00'))).toBe(ict('2026-10-19T00:00:00')));
  it('Monday 00:30 ICT (still Sunday in UTC) starts a new week', () =>
    expect(periodStart('week', ict('2026-10-26T00:30:00'))).toBe(ict('2026-10-26T00:00:00')));
});

describe('roundCrowns', () => {
  it('top scorer gets the crown; ties share it; nobody when no one scored', () => {
    expect(roundCrowns({ a: 12, b: 5 })).toEqual(['a']);
    expect(roundCrowns({ a: 6, b: 6, c: 1 }).sort()).toEqual(['a', 'b']);
    expect(roundCrowns({ a: 0, b: 0 })).toEqual([]);
  });
});

describe('aggregate', () => {
  const entries: WinLogEntry[] = [
    { roomId: 'R1', at: 100, scores: { a: 12, b: 5 }, names: { a: 'Ann', b: 'Bob' }, crowns: { a: true } },
    { roomId: 'R2', at: 200, scores: { a: 3, b: 10.5 }, names: { a: 'Ann B', b: 'Bob' }, crowns: { b: true } },
    { roomId: 'R3', at: 300, scores: { b: 8 }, names: { b: 'Bob' }, crowns: { b: true } },
  ];
  it('ranks by crowns, then points, using the latest name', () => {
    expect(aggregate(entries)).toEqual([
      { uid: 'b', name: 'Bob', crowns: 2, points: 23.5 },
      { uid: 'a', name: 'Ann B', crowns: 1, points: 15 },
    ]);
  });
  it('only counts rounds since the period start', () => {
    expect(aggregate(entries, 250)).toEqual([{ uid: 'b', name: 'Bob', crowns: 1, points: 8 }]);
  });
  it('breaks crown ties with points', () => {
    const tie: WinLogEntry[] = [
      { roomId: 'R', at: 1, scores: { a: 4, b: 9 }, crowns: { a: true } },
      { roomId: 'S', at: 2, scores: { a: 1, b: 2 }, crowns: { b: true } },
    ];
    expect(aggregate(tie).map((r) => r.uid)).toEqual(['b', 'a']);
  });
});
