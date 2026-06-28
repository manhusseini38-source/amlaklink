// ══════════════════════════════════════════
// Service Worker — شبکه املاک لینک
// ══════════════════════════════════════════
const CACHE_NAME = 'amlaklink-v1';
const DB_NAME = 'amlaklink-offline';
const DB_VERSION = 1;

// فایل‌های استاتیک که باید cache بشن
const STATIC_ASSETS = [
    './',
    './index.html',
];

// CDN های مهم
const CDN_CACHE = 'amlaklink-cdn-v1';
const CDN_URLS = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
    'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700;800;900&display=swap',
];

// ── Install ──
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// ── Activate ──
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME && k !== CDN_CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// ── Fetch ──
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Supabase API — Network first, fallback to cache
    if (url.hostname.includes('supabase.co')) {
        event.respondWith(networkFirstWithCache(event.request, 'amlaklink-api-v1'));
        return;
    }

    // CDN — Cache first
    if (url.hostname.includes('cdnjs.cloudflare.com') ||
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com')) {
        event.respondWith(cacheFirst(event.request, CDN_CACHE));
        return;
    }

    // فایل اصلی — Network first, fallback
    if (url.pathname.endsWith('.html') || url.pathname === '/') {
        event.respondWith(networkFirstWithCache(event.request, CACHE_NAME));
        return;
    }

    // بقیه — Cache first
    event.respondWith(cacheFirst(event.request, CACHE_NAME));
});

// Network first — اگه نت نبود از cache
async function networkFirstWithCache(request, cacheName) {
    try {
        const response = await fetch(request.clone());
        if (response && response.status === 200 && response.type !== 'opaque') {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        return cached || new Response('{"offline":true}', {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Cache first — اگه cache نبود از network
async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response && response.status === 200) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return new Response('', { status: 503 });
    }
}

// ── Background Sync ──
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncOfflineData());
    }
});

async function syncOfflineData() {
    // در آینده: sync کردن داده‌های آفلاین
    console.log('[SW] Background sync triggered');
}

// ── Push Notifications ──
self.addEventListener('push', event => {
    const data = event.data?.json() || {};
    event.waitUntil(
        self.registration.showNotification(data.title || 'شبکه املاک لینک', {
            body: data.body || '',
            icon: './icon-192.png',
            badge: './icon-72.png',
            dir: 'rtl',
            lang: 'fa',
            data: data
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(clients.openWindow('./'));
});
