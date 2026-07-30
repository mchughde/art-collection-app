const CACHE_NAME = 'impressionist-art-v7';
const BASE = self.registration.scope;
const APP_SHELL = [
  BASE,
  BASE + 'index.html',
  BASE + 'app.js',
  BASE + 'styles.css',
  BASE + 'manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-first for API calls
  if (url.hostname.includes('artic.edu') || url.hostname.includes('clevelandart.org')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Network-first for the app shell (HTML, JS, CSS) so updates always arrive;
  // fall back to cache only when offline
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
    return;
  }

  // Cache-first for cross-origin images (artwork images cached on add)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => new Response('', { status: 404 }));
    })
  );
});

// Cache an image URL on demand (called when adding to collection)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CACHE_IMAGE' && event.data.url) {
    caches.open(CACHE_NAME).then(cache =>
      fetch(event.data.url).then(response => {
        if (response.ok) cache.put(event.data.url, response);
      }).catch(() => {})
    );
  }
});
