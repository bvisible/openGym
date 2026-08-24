//// Neoffice — added file (no upstream equivalent), and the SOURCE OF TRUTH for
//// the service worker on Neoffice. frontend/public/sw.js still exists for the
//// standalone build; this copy is the one Frappe serves.
////
//// Why here, and why this name: a worker only controls URLs under its own
//// directory. Under /assets/opengym/… its scope excludes the page (that is the
//// bug Frappe CRM, hrms and pos_next all ship). At /gym/sw.js the scope is
//// "/gym/", which still excludes the bare "/gym" the page lives on — measured:
//// activated, controlling nothing. From the site root the maximum scope is "/",
//// so neoffice_gym registers it with {scope: "/gym"} and that covers both.
////
//// It lives in THIS repository because it is part of the journal (AGPL), not
//// part of our private integration — the private app only registers it.
////
//// ⚠️ Keep in step with frontend/public/sw.js until the build generates this
//// file (one npm script away, worth doing the day the caching strategy changes).

/* openGym service worker — runtime caching (works with Vite's hashed asset names).
   Media (img/gif) cache-first; everything else network-first with offline fallback. */
const CACHE = 'opengym-rt-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()))
})
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {}
  e.waitUntil(self.registration.showNotification(data.title || 'openGym', {
    body: data.body || '',
    icon: 'icon-512.png',
    badge: 'icon-180.png',
    tag: data.tag || 'opengym',
    renotify: true
  }))
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(clients => {
    const c = clients.find(c => 'focus' in c)
    return c ? c.focus() : self.clients.openWindow('./')
  }))
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) return    // never cache auth/data

  const isMedia = url.pathname.includes('/img/') || url.pathname.includes('/gif/')
  if (isMedia) {
    e.respondWith(caches.open(CACHE).then(c => c.match(e.request).then(hit =>
      hit || fetch(e.request).then(res => { if (res.ok) c.put(e.request, res.clone()); return res })
    )))
  } else {
    e.respondWith(fetch(e.request).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
      return res
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('index.html'))))
  }
})
