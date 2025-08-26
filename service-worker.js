/* Commit PWA Service Worker */
const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `commit-static-${CACHE_VERSION}`;
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
  // NOTE: we intentionally don't cache firebase CDN or dynamic Firestore content
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k.startsWith('commit-static-') && k !== STATIC_CACHE)
        .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// network-first for same-origin HTML; cache-first for static assets
self.addEventListener('fetch', event => {
  const req = event.request;

  // only handle GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  // HTML navigations: network-first (for fresh deploys)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const resClone = res.clone();
        caches.open(STATIC_CACHE).then(c => c.put('./', resClone));
        return res;
      }).catch(() => caches.match('./'))
    );
    return;
  }

  // static assets (same-origin): cache-first
  if (isSameOrigin) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const resClone = res.clone();
        caches.open(STATIC_CACHE).then(c => c.put(req, resClone));
        return res;
      }))
    );
    return;
  }

  // third-party (firebase cdn, gstatic): just go to network
  // (Firestore needs live network; we don't try to cache API calls here)
});
    