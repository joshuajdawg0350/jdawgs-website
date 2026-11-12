/* Hustle City 2 — offline service worker.
   Precaches the full game on first load; after that it boots and plays
   with no network at all. Bump CACHE when the game build changes. */
var CACHE = "hc2-full-v4";
var PRECACHE = [
 "./",
 "index.html",
 "manifest.webmanifest",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/icon-maskable-512.png",
 "assets/ambulance-driveoff.webm",
 "assets/ambulance.webp",
 "assets/balsey.webp",
 "assets/bills.webp",
 "assets/charger-blocks.webp",
 "assets/cover.webp",
 "assets/craps-bg-city-subway-ledsign-bright-poster.webp",
 "assets/craps-bg-city-subway-ledsign-bright.mp4",
 "assets/deal-buy-poster.webp",
 "assets/deal-buy.webm",
 "assets/deal-sell-poster.webp",
 "assets/deal-sell.webm",
 "assets/hero.webp",
 "assets/key-art-canonical.webp",
 "assets/lm-block-poster.webp",
 "assets/lm-block.mp4",
 "assets/lm-clean-poster.webp",
 "assets/lm-clean.webm",
 "assets/lm-fivefig-poster.webp",
 "assets/lm-fivefig.webm",
 "assets/lm-king-poster.webp",
 "assets/lm-king.mp4",
 "assets/lm-quarter-poster.webp",
 "assets/lm-quarter.webm",
 "assets/lm-rack-poster.webp",
 "assets/lm-rack.webm",
 "assets/lm-sixfig-poster.webp",
 "assets/lm-sixfig.webm",
 "assets/music-all-apple-no-pie.mp3",
 "assets/paw.png",
 "assets/roll-catch-poster.webp",
 "assets/roll-catch.mp4",
 "assets/roll-opponent-poster.webp",
 "assets/roll-opponent.mp4",
 "assets/roll-player-poster.webp",
 "assets/roll-player.mp4",
 "assets/scene-arrest-cuffs-poster.webp",
 "assets/scene-arrest-cuffs.mp4",
 "assets/scene-arrest-poster.webp",
 "assets/scene-bank-poster.webp",
 "assets/scene-bank.mp4",
 "assets/scene-coronation-poster.webp",
 "assets/scene-coronation.mp4",
 "assets/scene-deal-humans-poster.webp",
 "assets/scene-deal-humans.mp4",
 "assets/scene-deal-poster.webp",
 "assets/scene-deal.mp4",
 "assets/scene-police-raid-poster.webp",
 "assets/scene-police-raid.mp4",
 "assets/scene-raid-poster.webp",
 "assets/scene-rideoff-poster.webp",
 "assets/scene-rideoff.mp4",
 "assets/scene-shark-poster.webp",
 "assets/scene-shark.mp4",
 "assets/scene-throne-poster.webp",
 "assets/scene-throne.mp4",
 "assets/scene-travel-poster.webp",
 "assets/scene-travel.mp4",
 "assets/scene-wait-day-poster.webp",
 "assets/scene-wait-day.mp4",
 "assets/scene-wait-poster.webp",
 "assets/shark-arrival-poster.webp",
 "assets/shark-arrival.webm",
 "assets/shark.webp",
 "assets/travel-drive.webm",
 "assets/travel-poster.webp"
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

function serveRange(request, response) {
  var range = request.headers.get("range");
  if (!range) return response;
  return response.clone().blob().then(function (blob) {
    var m = /bytes=(\d+)-(\d*)/.exec(range);
    if (!m) return response;
    var start = parseInt(m[1], 10);
    var end = m[2] ? parseInt(m[2], 10) : blob.size - 1;
    if (start >= blob.size) {
      return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + blob.size } });
    }
    end = Math.min(end, blob.size - 1);
    var part = blob.slice(start, end + 1, blob.type);
    return new Response(part, {
      status: 206,
      statusText: "Partial Content",
      headers: {
        "Content-Type": blob.type,
        "Content-Length": String(part.size),
        "Content-Range": "bytes " + start + "-" + end + "/" + blob.size,
        "Accept-Ranges": "bytes"
      }
    });
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var url = new URL(request.url);

  if (url.origin === self.location.origin) {
    /* Same-origin (the game itself): cache first, network to fill gaps. */
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then(function (hit) {
        if (hit) return serveRange(request, hit);
        return fetch(request).then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
          }
          return res;
        });
      })
    );
    return;
  }

  /* Cross-origin (Google Fonts): cache first, refresh in the background,
     so text still renders offline with the downloaded fonts when present. */
  event.respondWith(
    caches.match(request).then(function (hit) {
      var network = fetch(request).then(function (res) {
        if (res && (res.status === 200 || res.type === "opaque")) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || network;
    })
  );
});
