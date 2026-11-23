/* Human Hands worker app service worker — scope /human-hands/.
   Shell: cache-first so the app opens instantly. Pages and board data:
   network-first, so jobs are never stale — the cache is only a fallback
   for a dead connection. Push: job alerts from the HH backend
   (POST /api/push/send) land here and open the board on tap. */
const CACHE = 'hh-app-v1';
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
      .then((cache) => cache.addAll(SHELL))
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
    // Network-first: a worker must never see a stale board.
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

  // Static shell assets: cache-first, refreshed in the background.
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
