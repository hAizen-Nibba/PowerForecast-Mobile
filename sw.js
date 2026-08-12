const CACHE_NAME = 'powerforecast-v1.0.0';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './home.html',
  './login.html',
  './signup.html',
  './forgot-password.html',
  './docs.html',
  './manifest.json',
  './pwa-install.js',
  './rates.json',
  './appliance_db.json',
  './Assets/LOGO.png',
  './Assets/Dark.png',
  './Assets/Light .png',
  './Assets/icons/icon-192.png',
  './Assets/icons/icon-512.png',
  './Assets/icons/icon-512-maskable.png',
  './Assets/icons/apple-touch-icon.png',
  './Assets/icons/favicon-32x32.png'
];

// Install Event
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[Service Worker] Pre-caching core app shell');
      // Use Promise.allSettled so individual missing assets don't break installation
      const promises = PRECACHE_ASSETS.map((url) =>
        cache.add(url).catch((err) => {
          console.warn(`[Service Worker] Pre-cache failed for ${url}:`, err);
        })
      );
      await Promise.allSettled(promises);
    })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests and browser extensions
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Network-First for API requests
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Stale-While-Revalidate for static resources (CDNs, fonts, app shell, images)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch((err) => {
          console.log('[Service Worker] Network request failed:', err);
          if (request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./home.html');
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Handle messages from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
