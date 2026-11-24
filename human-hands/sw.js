/* Human Hands worker app service worker — scope /human-hands/.
   Update path (the rule that matters): a published fix must REACH phones.
   Navigations and the app code itself (JS/CSS) are NETWORK-FIRST — the
   cache is only an offline fallback — and the shell precache bypasses the
   HTTP cache, so a new deploy lands on the next visit instead of being
   served stale from the app's own cache. Images/icons stay cache-first
   with a background refresh. Push: job alerts from the HH backend
   (POST /api/push/send) land here and open the board on tap.
   Version: 2026-11-23-2 (cache hh-app-v2) — bump both on every deploy
   that changes the shell; the version stamp is also printed on
   alerts.html so support can see what a phone is actually serving. */
const CACHE = 'hh-app-v2';
const VERSION = '2026-11-23-2';
const SHELL = [
  '/human-hands/board.html',
  '/human-hands/work.html',
  '/human-hands/alerts.html',
  '/human-hands/manifest.webmanifest',
  '/human-hands/hh-config.js',
  '/human-hands/hh-google.js',
  '/human-hands/hh-app.js',
  '/human-hands/hh-app.css',
  '/human-hands/icons/hh-icon-192.png',
  '/human-hands/icons/hh-icon-512.png',
  '/human-hands/icons/hh-icon-maskable-512.png',
  '/assets/site.css'
];
const BOARD = '/human-hands/board.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // {cache:'reload'} — precache the NEW bytes from the network, not
      // whatever the HTTP cache (GitHub Pages max-age) is still holding.
      .then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('hh-app-') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API + Google: straight to network

  if (req.mode === 'navigate') {
    // Network-first: a worker must never see a stale board — or a stale
    // fix. The cache answers only when the network is dead.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(BOARD)))
    );
    return;
  }

  const isCode = /\.(?:js|css)$/.test(url.pathname) || url.searchParams.has('fresh');
  if (isCode) {
    // App code: NETWORK-FIRST, revalidating past the HTTP cache. Serving
    // JS cache-first is what let a published fix sit on the server while
    // phones kept running the old file — never again. Cache is the
    // offline fallback only.
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Images, icons, manifest: cache-first, refreshed in the background.
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || network;
    })
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* fall through to defaults */ }
  const title = data.title || 'Human Hands — new job';
  const options = {
    body: data.body || 'A new job just posted. Tap to see it on the board.',
    icon: '/human-hands/icons/hh-icon-192.png',
    badge: '/human-hands/icons/hh-icon-192.png',
    tag: data.tag || 'hh-job',
    data: { url: data.url || 'https://jdawgsindustries.com/human-hands/board.html' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || BOARD;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if (win.url.includes('/human-hands/') && 'focus' in win) {
          win.navigate(target);
          return win.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'HH_SKIP_WAITING') self.skipWaiting();
});
