/* Hustle City — offline service worker (shell + local assets).
   NOTE: scene videos stream from joshuajdawg0350.github.io/jdawgs-hub and
   are NOT precached — they need a connection. Everything else (game code,
   art, saves in localStorage) works offline after the first load. */
var CACHE = "hc1-full-v2";
var PRECACHE = [
 "./",
 "index.html",
 "manifest.webmanifest",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/icon-maskable-512.png",
 "assets/ambulance-poster.webp",
 "assets/ambulance.webp",
 "assets/arrest-cuffs-poster.webp",
 "assets/bills.webp",
 "assets/charger-blocks.webp",
 "assets/deal-buy-poster.webp",
 "assets/deal-sell-poster.webp",
 "assets/hands-left.webp",
 "assets/hands-right.webp",
 "assets/hero.webp",
 "assets/key-art-canonical.webp",
 "assets/lm-block-poster.webp",
 "assets/lm-clean-poster.webp",
 "assets/lm-fivefig-poster.webp",
 "assets/lm-king-poster.webp",
 "assets/lm-quarter-poster.webp",
 "assets/lm-rack-poster.webp",
 "assets/lm-sixfig-poster.webp",
 "assets/paw.png",
 "assets/police-raid-poster.webp",
 "assets/shark-arrival-poster.webp",
 "assets/shark.webp",
 "assets/travel-poster.webp",
 "assets/.thumbnails/media-generation-ambulance-driveoff-0-e5328191-3bfe-4192-a181-ad559e3c57bc.jpg",
 "assets/.thumbnails/media-generation-lm-block-0-f0991304-b71b-4d2f-928b-cfea7a6d9a1c.jpg",
 "assets/.thumbnails/media-generation-lm-clean-0-4775d92c-3d30-485d-8610-cf8c7cad9fc4.jpg",
 "assets/.thumbnails/media-generation-lm-fivefig-0-40a84dfa-c931-48cc-82d3-73871345ebe9.jpg",
 "assets/.thumbnails/media-generation-lm-king-0-445a4fcb-06db-4585-9ecb-9a047886cdd4.jpg",
 "assets/.thumbnails/media-generation-lm-quarter-0-063480d1-b5d6-4266-8909-4950c55a6dfc.jpg",
 "assets/.thumbnails/media-generation-lm-rack-0-351409e5-50f9-4c4e-b89c-8c8e131592b0.jpg",
 "assets/.thumbnails/media-generation-lm-sixfig-0-d1fc4d19-d4ac-4d73-a089-e345cb44adb0.jpg",
 "assets/.thumbnails/media-generation-shark-arrival-0-e078ac65-8850-4b58-ab6e-b794cdcf1161.jpg"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(PRECACHE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return; /* streamed video: straight to network */
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(request).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return res;
      });
    })
  );
});
