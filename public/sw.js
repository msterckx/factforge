const CACHE = 'got-v5';

// Cache Next.js static assets on first fetch
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests from our own origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Next.js immutable static chunks — cache first, forever
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Images and public assets — stale-while-revalidate: answer from the cache
  // when possible, and refresh it in the background. Images keep descriptive
  // names, so a replaced image comes back under the same URL.
  if (
    url.pathname.startsWith('/logos/') ||
    url.pathname.startsWith('/uploads/') ||
    url.pathname.startsWith('/api/images/')
  ) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((res) => {
              if (res.ok) cache.put(request, res.clone());
              return res;
            })
            .catch(() => cached);
          if (cached) {
            event.waitUntil(network);
            return cached;
          }
          return network;
        })
      )
    );
    return;
  }

  // Navigation and API — network first, no offline fallback needed
});
