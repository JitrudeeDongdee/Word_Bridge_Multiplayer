/*
 * Minimal service worker: makes the site an installable PWA (needed for the Play Store app,
 * a Trusted Web Activity) and shows a friendly page when there is no connection.
 *
 * It deliberately caches nothing else: every request goes to the network as before, so
 * new deploys (hashed JS chunks + version.txt check) keep working exactly as without it.
 * Bump CACHE when offline.html changes.
 */
const CACHE = 'wb-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(new Request(OFFLINE_URL, { cache: 'reload' }))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  // Only page loads get the offline fallback; everything else is untouched
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL, { cacheName: CACHE })),
  );
});
