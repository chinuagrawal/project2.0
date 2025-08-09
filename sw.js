const cacheName = 'kanha-library-cache-v4'; // updated version

const assetsToCache = [
  '/',
  // Add more static assets here (CSS, JS, images, etc.)
];

// Install: cache essential files
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(cacheName).then((cache) => {
      return cache.addAll(assetsToCache);
    })
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== cacheName)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip caching Google Maps & tracking scripts
  const url = event.request.url;
  if (
    url.includes('google.com/maps') ||
    url.includes('googletagmanager.com') ||
    url.includes('googlesyndication.com') ||
    url.includes('cloudflareinsights.com')
  ) {
    return; // Let them load normally without caching
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Only cache valid 200 OK responses of type 'basic'
        if (!res || res.status !== 200 || res.type !== 'basic') {
          return res;
        }

        const resClone = res.clone();
        caches.open(cacheName).then((cache) => {
          cache.put(event.request, resClone);
        });
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
