/* global __PRECACHE__ */
// Service worker веб-версии: приложение открывается и без сети.
// Шаблон — список файлов, версию и базовый путь подставляет
// scripts/build-web.js при сборке (готовый файл — dist/sw.js).
//
// Данные (акты, очередь сканов) здесь не кэшируются — их хранит само
// приложение (constants/offline.ts), запросы к /api идут мимо.
const VERSION = '__VERSION__'
const BASE = '__BASE__'
const PRECACHE = __PRECACHE__
const CACHE = `scanner-${VERSION}`

// Страница без ответа дольше этого — берём из кэша (слабый Wi-Fi)
const NAV_TIMEOUT_MS = 4000

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('scanner-') && k !== CACHE).map(k => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  )
})

const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      r => { clearTimeout(t); resolve(r) },
      e => { clearTimeout(t); reject(e) },
    )
  })

self.addEventListener('fetch', event => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  if (!url.pathname.startsWith(`${BASE}/`)) return

  // Страница — сначала сеть (чтобы подхватить новую версию), без сети — кэш.
  // Любой путь приложения отдаёт один index.html (web.output: single)
  if (req.mode === 'navigate') {
    event.respondWith(
      withTimeout(fetch(req), NAV_TIMEOUT_MS)
        .catch(() => caches.match(`${BASE}/index.html`))
        .then(res => res || fetch(req)),
    )
    return
  }

  // Бандлы и шрифты с хэшем в имени не меняются — кэш, потом сеть
  event.respondWith(caches.match(req).then(hit => hit || fetch(req)))
})
