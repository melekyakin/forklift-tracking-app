// Service Worker for PWA
const CACHE_NAME = 'forklift-takip-v3'; // Version güncellendi - POST cache hatası düzeltildi
const urlsToCache = [
  '/',
  '/index.html',
  '/static/css/main.css',
  '/static/js/main.js'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // API isteklerini ve POST/PUT/DELETE isteklerini cache'leme
  const url = new URL(event.request.url);
  const isApiRequest = url.pathname.startsWith('/api/');
  const isNonGetRequest = event.request.method !== 'GET';
  
  // API istekleri ve POST/PUT/DELETE istekleri için cache'leme yapma
  // Bu istekleri olduğu gibi network'e gönder, cache'leme
  // Cache API sadece GET isteklerini destekler!
  if (isApiRequest || isNonGetRequest) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Sadece GET istekleri ve API olmayan istekler için cache kullan
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Sadece başarılı GET isteklerini ve cache'lenebilir response'ları cache'e kaydet
        // Cache API sadece GET isteklerini destekler!
        if (response.status === 200 && 
            response.type === 'basic' && 
            event.request.method === 'GET' &&
            !isApiRequest) {
          // Clone the response before caching
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              // Son bir kez daha kontrol et - sadece GET isteklerini cache'e kaydet
              if (event.request.method === 'GET') {
                cache.put(event.request, responseToCache).catch((err) => {
                  // Cache hatası sessizce yok say
                  console.warn('Cache put hatası:', err);
                });
              }
            })
            .catch((err) => {
              // Cache hatası sessizce yok say
              console.warn('Cache open hatası:', err);
            });
        }
        
        return response;
      })
      .catch(() => {
        // Sadece GET istekleri için cache'den döndür
        if (event.request.method === 'GET' && !isApiRequest) {
          return caches.match(event.request);
        }
        // POST/PUT/DELETE istekleri için cache'den döndürme
        return new Response('Network error', { status: 408 });
      })
  );
});

// Activate event - Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      ).then(() => {
        // Tüm eski cache'leri temizledikten sonra clients'a kontrol mesajı gönder
        return self.clients.claim();
      });
    })
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Forklift Takip Sistemi';
  const options = {
    body: data.body || 'Yeni bildirim',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: data
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});

