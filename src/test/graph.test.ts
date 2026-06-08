import { describe, it, expect } from 'vitest';
import { checkWin, findPath } from '../utils/graph';
import type { GameEdge } from '../types';

const edge = (id: string, source: string, target: string): GameEdge => ({ id, source, target });

describe('checkWin', () => {
  it('returns true for a direct edge', () => {
    const edges = [edge('e1', 'A', 'B')];
    expect(checkWin('A', 'B', edges)).toBe(true);
  });

  it('returns true for a multi-hop path', () => {
    const edges = [edge('e1', 'A', 'C'), edge('e2', 'C', 'D'), edge('e3', 'D', 'B')];
    expect(checkWin('A', 'B', edges)).toBe(true);
  });

  it('returns false when no path exists', () => {
    const edges = [edge('e1', 'A', 'C'), edge('e2', 'D', 'B')];
    expect(checkWin('A', 'B', edges)).toBe(false);
  });

  it('returns false for empty edge list', () => {
    expect(checkWin('A', 'B', [])).toBe(false);
  });

  it('returns true when start equals target', () => {
    expect(checkWin('A', 'A', [])).toBe(true);
  });

  it('handles cycles without infinite loop', () => {
    const edges = [
      edge('e1', 'A', 'C'),
      edge('e2', 'C', 'A'),
      edge('e3', 'C', 'D'),
      edge('e4', 'D', 'B'),
    ];
    expect(checkWin('A', 'B', edges)).toBe(true);
  });

  it('traverses undirected edges in reverse', () => {
    // Edge defined as B→A but A→B should still work (undirected)
    const edges = [edge('e1', 'B', 'A')];
    expect(checkWin('A', 'B', edges)).toBe(true);
  });
});

describe('findPath', () => {
  it('returns direct path', () => {
    const edges = [edge('e1', 'A', 'B')];
    expect(findPath('A', 'B', edges)).toEqual(['A', 'B']);
  });

  it('returns shortest path', () => {
    const edges = [
      edge('e1', 'A', 'C'),
      edge('e2', 'C', 'B'),
      edge('e3', 'A', 'X'),
      edge('e4', 'X', 'Y'),
      edge('e5', 'Y', 'B'),
    ];
    expect(findPath('A', 'B', edges)).toEqual(['A', 'C', 'B']);
  });

  it('returns null when no path exists', () => {
    const edges = [edge('e1', 'A', 'C')];
    expect(findPath('A', 'B', edges)).toBeNull();
  });

  it('returns single element for start === target', () => {
    expect(findPath('A', 'A', [])).toEqual(['A']);
  });
});
