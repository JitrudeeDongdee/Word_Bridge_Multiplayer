import { describe, expect, it } from 'vitest';
import { hideBlocked } from '../services/moderationService';
import type { ChatMessage } from '../types';

const msg = (id: string, playerId: string, playerName = playerId): ChatMessage => ({ id, playerId, playerName, text: 'hi', sentAt: 1 });

describe('hideBlocked', () => {
  const messages = [msg('1', 'ann'), msg('2', 'bob', 'Bob'), msg('3', 'ann'), msg('4', 'cat'), msg('5', 'bob', 'Bob')];

  it('keeps everything when nobody is blocked', () => {
    const r = hideBlocked(messages, {});
    expect(r.visible).toHaveLength(5);
    expect(r.hiddenFrom).toEqual([]);
  });

  it('drops blocked players and lists each once', () => {
    const r = hideBlocked(messages, { bob: { name: 'Bob', at: 1 } });
    expect(r.visible.map((m) => m.id)).toEqual(['1', '3', '4']);
    expect(r.hiddenFrom).toEqual([{ id: 'bob', name: 'Bob' }]);
  });

  it('only lists blocked players who actually wrote here', () => {
    const r = hideBlocked(messages, { zed: { name: 'Zed', at: 1 } });
    expect(r.visible).toHaveLength(5);
    expect(r.hiddenFrom).toEqual([]);
  });
});
