/**
 * Google Analytics 4, loaded only after the player accepts the consent banner (PDPA).
 *
 * - Nothing is sent, and gtag.js is not even downloaded, until consent is "granted".
 * - Only the production site sends data, so local dev and the emulators never pollute reports.
 * - Events carry counts and flags only: never words, chat text, names, emails or room codes.
 */

export const MEASUREMENT_ID = 'G-EFRD06ENBH';
const PRODUCTION_HOST = 'wordbridgemultiplayer.thaidongdee.com';
export const CONSENT_KEY = 'wb-analytics-consent';

export type Consent = 'granted' | 'denied';

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

const listeners = new Set<() => void>();
let loaded = false;

/** True on the site that reports to GA (production, or a build with VITE_GA_FORCE=1). */
export function enabledHere(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === PRODUCTION_HOST || import.meta.env.VITE_GA_FORCE === '1';
}

export function getConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

/** Whether the banner should ask: only where analytics actually runs, and only once. */
export function needsConsent(): boolean {
  return enabledHere() && getConsent() === null;
}

export function setConsent(value: Consent | null): void {
  try {
    if (value) localStorage.setItem(CONSENT_KEY, value);
    else localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  if (value === 'granted') load();
  else if (loaded) window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
  listeners.forEach((fn) => fn());
}

export function onConsentChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function load(): void {
  if (loaded || !enabledHere()) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  // gtag must push the `arguments` object itself, not an array
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.gtag('js', new Date());
  // Page views are sent by hand (hash routes); Google Signals / ads features stay off
  window.gtag('config', MEASUREMENT_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(s);
}

/** Starts GA on page load when the player already said yes on an earlier visit. */
export function initAnalytics(): void {
  if (getConsent() === 'granted') load();
}

function active(): boolean {
  return loaded && getConsent() === 'granted' && !!window.gtag;
}

/** Room codes and other ids are replaced so reports group pages, not individual rooms. */
export function routeName(path: string): string {
  return path.replace(/^\/(join|lobby|game|victory)\/[^/]+/, '/$1/:roomId') || '/';
}

export function trackPageView(path: string): void {
  if (!active()) return;
  // GA drops the #fragment, so the route goes in the path: reports show /lobby/:roomId etc.
  window.gtag!('event', 'page_view', {
    page_title: document.title,
    page_location: `${window.location.origin}${routeName(path)}`,
  });
}

export type AnalyticsEvent =
  | 'sign_up'
  | 'login'
  | 'create_room'
  | 'join_room'
  | 'game_start'
  | 'game_restart'
  | 'round_end'
  | 'add_word'
  | 'vote_link'
  | 'dict_lookup'
  | 'chat_message'
  | 'share_invite';

export function track(name: AnalyticsEvent, params: Record<string, string | number | boolean> = {}): void {
  if (!active()) return;
  window.gtag!('event', name, params);
}
