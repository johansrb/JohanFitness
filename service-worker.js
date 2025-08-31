// service-worker.js  (App Shell, full offline after first load)
const CACHE = 'johan-fitness-cache-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install: precache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Fetch:
// 1) For navigations (page loads/refresh): return cached index.html (SPA app-shell)
// 2) For same-origin static requests: cache-first
// 3) For cross-origin (e.g., YouTube): network only with offline fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== 'GET') return;

  // Handle SPA navigations
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(cached => {
        return cached || fetch('./index.html');
      })
    );
    return;
  }

  const url = new URL(req.url);

  // Same-origin: cache-first
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((resp) => {
          // Best-effort: stash a copy
          const copy = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return resp;
        }).catch(() => {
          // If offline and not cached, fallback to app shell when sensible
          if (req.destination === 'document') return caches.match('./index.html');
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
    );
    return;
  }

  // Cross-origin: network first (don’t cache 3rd-party aggressively)
  event.respondWith(
    fetch(req).catch(() => new Response('Offline', { status: 503, statusText: 'Offline' }))
  );
});

