/**
 * RIVER-WALL ERP V.5.0 - Service Worker
 * PWA with offline support + CDN caching
 */

const CACHE_NAME = 'rw-cache-v' + new Date().getFullYear() + '.' + String(new Date().getMonth() + 1).padStart(2, '0');
const APP_SHELL = [
    '/software.html',
    '/',
    '/manifest.webmanifest',
    '/env.js',
    '/supabase-client.js',
    '/offline-mode.js',
    '/styles.css',
    '/logo-river.png',
    '/icon-192.png',
    '/icon-512.png',
    '/scripts/rw-i18n.js',
    '/scripts/thermal-printer.js',
    '/scripts/rw-accounting.js',
    '/scripts/rw-reports.js',
    '/scripts/rw-pos.js',
    '/scripts/rw-numpad.js',
    '/modules/firebase-compat.js',
    '/modules/data-store.js',
    '/modules/app-state.js',
    '/modules/ui-controller.js',
    '/modules/offline-auth.js',
    '/modules/app-controller.js',
    '/modules/supabase-adapter.js',
];

const CDN_RESOURCES = [
    'https://cdn.jsdelivr.net/',
    'https://unpkg.com/',
    'https://fonts.googleapis.com/',
    'https://fonts.gstatic.com/',
    'https://cdnjs.cloudflare.com/',
];

// Resources we should NEVER try to cache (non-GET, APIs, analytics, etc.)
const NEVER_CACHE = [
    '/api/',
    '/auth/',
    '/rest/v1/',
    '/realtime/',
    '/rpc/',
    'chrome-extension://',
    'blob:',
    'data:',
];

function shouldNeverCache(request) {
    const url = request.url;
    const method = request.method;
    if (method !== 'GET') return true;
    if (url.includes('supabase.co') || url.includes('supabase.in')) return true;
    return NEVER_CACHE.some((prefix) => url.includes(prefix));
}

// Install: cache app shell
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            const promises = APP_SHELL.map((url) =>
                cache.add(url).catch((err) => {
                    console.warn('[SW] Failed to cache:', url, err?.message || err);
                })
            );
            return Promise.all(promises);
        })
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // 1. Skip non-GET, Supabase API, and other non-cacheable requests
    if (shouldNeverCache(request)) {
        return; // Let browser handle it natively
    }

    // 2. Navigation requests (HTML pages): network first, fallback to cache
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request).then((cached) => {
                        if (cached) return cached;
                        return caches.match('/software.html');
                    });
                })
        );
        return;
    }

    // 3. CDN assets: cache first, update in background
    if (CDN_RESOURCES.some((prefix) => url.href.startsWith(prefix))) {
        event.respondWith(
            caches.match(request).then((cached) => {
                const fetchPromise = fetch(request)
                    .then((networkResponse) => {
                        if (networkResponse.ok) {
                            const clone = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                        }
                        return networkResponse;
                    })
                    .catch(() => cached || new Response('CDN offline', { status: 503 }));
                return cached || fetchPromise;
            })
        );
        return;
    }

    // 4. Same-origin static assets: stale-while-revalidate
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(request).then((cached) => {
                const fetchPromise = fetch(request)
                    .then((networkResponse) => {
                        if (networkResponse.ok) {
                            const clone = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        if (cached) return cached;
                        // Silently return empty 200 for missing non-critical assets (favicons, icons)
                        // to prevent console spam
                        if (request.url.includes('favicon') || request.url.includes('icon-')) {
                            return new Response(null, { status: 200 });
                        }
                        return new Response('Not found', { status: 404 });
                    });
                return cached || fetchPromise;
            })
        );
        return;
    }

    // 5. Everything else: network only
    event.respondWith(fetch(request));
});

// Background sync for queued operations
self.addEventListener('sync', (event) => {
    if (event.tag === 'rw-sync-queue') {
        event.waitUntil(
            self.clients.matchAll({ type: 'window' }).then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({ type: 'PROCESS_SYNC_QUEUE' });
                });
            })
        );
    }
});

// Push notifications (future)
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};
    event.waitUntil(
        self.registration.showNotification(data.title || 'RIVER-WALL ERP V.5.0', {
            body: data.body || 'Nueva notificación',
            icon: '/logo-river.png',
            badge: '/logo-river.png',
            data: data.url || '/',
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data));
});
