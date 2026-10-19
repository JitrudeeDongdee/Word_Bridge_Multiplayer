import { describe, it, expect, beforeEach, vi } from 'vitest';

// Fresh module per test: `loaded` is module state
async function load() {
  vi.resetModules();
  return import('../services/analytics');
}

const gtagScripts = () => document.querySelectorAll('script[src*="googletagmanager"]').length;

describe('analytics consent', () => {
  beforeEach(() => {
    // This jsdom has no localStorage; a Map-backed stand-in is enough
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    });
    document.head.querySelectorAll('script').forEach((s) => s.remove());
    delete window.gtag;
    delete window.dataLayer;
    vi.unstubAllEnvs();
  });

  it('does nothing off the production site (dev, emulators)', async () => {
    const a = await load();
    expect(a.needsConsent()).toBe(false);
    a.setConsent('granted');
    expect(gtagScripts()).toBe(0);
  });

  it('asks first, and loads nothing until accepted', async () => {
    vi.stubEnv('VITE_GA_FORCE', '1');
    const a = await load();
    expect(a.needsConsent()).toBe(true);
    a.initAnalytics();
    a.track('add_word');
    expect(gtagScripts()).toBe(0);
    expect(window.dataLayer).toBeUndefined();
  });

  it('declining keeps GA off and stops asking', async () => {
    vi.stubEnv('VITE_GA_FORCE', '1');
    const a = await load();
    a.setConsent('denied');
    expect(a.needsConsent()).toBe(false);
    expect(gtagScripts()).toBe(0);
  });

  it('accepting loads gtag once and sends events', async () => {
    vi.stubEnv('VITE_GA_FORCE', '1');
    const a = await load();
    a.setConsent('granted');
    a.setConsent('granted');
    expect(gtagScripts()).toBe(1);
    a.track('create_room', { has_password: false });
    const names = (window.dataLayer as IArguments[]).map((args) => `${args[0]}:${args[1]}`);
    expect(names).toContain('event:create_room');
    expect(names).toContain(`config:${a.MEASUREMENT_ID}`);
  });

  it('a returning player who accepted is measured from page load', async () => {
    vi.stubEnv('VITE_GA_FORCE', '1');
    localStorage.setItem('wb-analytics-consent', 'granted');
    const a = await load();
    a.initAnalytics();
    expect(gtagScripts()).toBe(1);
  });
});

describe('routeName', () => {
  it('hides room codes', async () => {
    const { routeName } = await load();
    expect(routeName('/lobby/ABC123')).toBe('/lobby/:roomId');
    expect(routeName('/game/ABC123')).toBe('/game/:roomId');
    expect(routeName('/join/ABC123')).toBe('/join/:roomId');
    expect(routeName('/rooms')).toBe('/rooms');
    expect(routeName('')).toBe('/');
  });
});
