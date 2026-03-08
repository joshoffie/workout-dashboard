const CACHE_NAME = 'trunk-app-shell-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.png'
];

// 1. INSTALL: Pre-cache the vault
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force the new SW to activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// 2. ACTIVATE: Clean up old vaults
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});

// 3. FETCH: Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests for our assets
  if (event.request.method !== 'GET') return;
  
  // Don't intercept Firebase API calls
  if (event.request.url.includes('firestore.googleapis.com')) return;
  if (event.request.url.includes('identitytoolkit.googleapis.com')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Background network fetch to update the cache for next time
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(() => {
        // Silently fail if offline, the user already has the cached response
      });

      // INSTANTLY return the cached response if we have it, otherwise wait for the network
      return cachedResponse || fetchPromise;
    })
  );
});
