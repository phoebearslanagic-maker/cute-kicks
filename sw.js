// Service worker: cache-first app shell so Cute Kicks works fully offline.
// Each deploy rewrites STAMP (via scripts/deploy.sh), which makes this file
// byte-different; the browser installs the new worker, which caches the new
// assets and takes over — the page reloads itself once to pick it up.

const STAMP = '?v=1781256394'; // rewritten by scripts/deploy.sh
const CACHE = 'cute-kicks-' + STAMP.slice(3);

const ASSETS = [
  './',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './css/app.css' + STAMP,
  ...['app', 'db', 'episodes', 'export', 'history', 'log', 'patterns', 'settings', 'store', 'time']
    .map((m) => './js/' + m + '.js' + STAMP),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.match('./').then((r) => r || fetch(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then((r) => r || fetch(event.request)));
});
