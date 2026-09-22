const VERSION = new URL(self.location.href).searchParams.get('v') || '1';
const CACHE_NAME = 'night-game-' + VERSION;

function isGameAsset(url) {
  try {
    const path = new URL(url).pathname;
    return path.endsWith('/night.pck') || path.endsWith('/night.wasm') || path.endsWith('night.pck');
  } catch (err) {
    return false;
  }
}

self.addEventListener('install', function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    const keys = await caches.keys();
    await Promise.all(keys.filter(function (key) {
      return key.indexOf('night-game-') === 0 && key !== CACHE_NAME;
    }).map(function (key) {
      return caches.delete(key);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET' || !isGameAsset(event.request.url)) return;
  event.respondWith((async function () {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok && response.type !== 'opaque') {
      event.waitUntil(cache.put(event.request, response.clone()).catch(function () {}));
    }
    return response;
  })());
});
