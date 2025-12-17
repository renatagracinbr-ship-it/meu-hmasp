// Service Worker - Meu HMASP
const CACHE_NAME = 'meu-hmasp-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/logo-hmasp.png',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// Instalacao do Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Cache aberto');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.log('Erro ao cachear:', error);
            })
    );
    // Ativar imediatamente
    self.skipWaiting();
});

// Ativacao do Service Worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Removendo cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Tomar controle imediatamente
    self.clients.claim();
});

// Interceptar requisicoes
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Retorna do cache se disponivel, senao busca na rede
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
            .catch(() => {
                // Se falhar, retorna a pagina offline (se existir)
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            })
    );
});
