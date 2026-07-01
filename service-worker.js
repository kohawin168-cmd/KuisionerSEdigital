// ============================================
// SERVICE WORKER - Sensus Ekonomi 2026
// PWA Offline Support
// ============================================

const CACHE_NAME = 'sensus-ekonomi-2026-v1';
const STATIC_ASSETS = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    './icon-192x192.png',
    './icon-512x512.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        }).catch((err) => {
            console.warn('[SW] Failed to cache some assets:', err);
        })
    );
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Skip non-GET requests and chrome-extension requests
    if (request.method !== 'GET' || request.url.startsWith('chrome-extension://')) {
        return;
    }

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            // Return cached response if found
            if (cachedResponse) {
                // Fetch fresh version in background
                fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, networkResponse.clone());
                        });
                    }
                }).catch(() => {
                    // Network failed, cached version is already being served
                });
                return cachedResponse;
            }

            // Not in cache, fetch from network
            return fetch(request).then((networkResponse) => {
                // Don't cache non-success responses
                if (!networkResponse || networkResponse.status !== 200) {
                    return networkResponse;
                }

                // Clone and cache the response
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // Network failed and not in cache
                // For HTML requests, return the offline page
                if (request.headers.get('accept')?.includes('text/html')) {
                    return caches.match('./index.html');
                }
                return new Response('Offline - Data tersimpan di IndexedDB', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: new Headers({
                        'Content-Type': 'text/plain'
                    })
                });
            });
        })
    );
});

// Background sync for queued data (optional enhancement)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-sensus-data') {
        console.log('[SW] Background sync triggered');
        // Could implement background sync logic here
    }
});

// Push notification support (optional)
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Sensus Ekonomi 2026';
    const options = {
        body: data.body || 'Pengingan pendataan',
        icon: './icon-192x192.png',
        badge: './icon-192x192.png',
        data: data
    };
    event.waitUntil(self.registration.showNotification(title, options));
});
