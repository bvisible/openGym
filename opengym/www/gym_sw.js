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

//// Neoffice — rewritten, and it fixes a real bug rather than adapting one.
////
//// Upstream cached nothing at all. Three reasons, in order of how much they
//// cost:
////
////  1. `caches.open(CACHE).then(c => c.put(req, res.clone()))` cloned the
////     response INSIDE the .then(), i.e. one microtask after `return res` had
////     already handed the body to the page. By then the body is consumed and
////     clone() throws "Response body is already used" — into a promise with no
////     .catch(), so it failed in complete silence. Measured on osiris: worker
////     controlling the page, cache created, zero entries. Cloning must happen
////     synchronously, before the response is returned.
////  2. Nothing was tied to event.waitUntil(), so even a successful write was
////     racing the worker going to sleep.
////  3. The offline fallback looked for 'index.html'. On Neoffice the shell is
////     served at /gym by Frappe — there is no index.html to fall back to, so
////     the one case the cache exists for (no network) found nothing.
////
//// Everything else is upstream's design and stays: media cache-first, the rest
//// network-first, /api/ never cached — a stale workout or a stale session is
//// worse than no answer.
const SHELL = '/gym'

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) return    // never cache auth/data

  const isMedia = url.pathname.includes('/img/') || url.pathname.includes('/gif/')
  if (isMedia) {
    e.respondWith(caches.open(CACHE).then(c => c.match(e.request).then(hit =>
      hit || fetch(e.request).then(res => {
        //// Neoffice — clone before anything else can read the body.
        if (res.ok) { const copy = res.clone(); e.waitUntil(c.put(e.request, copy)) }
        return res
      })
    )))
  } else {
    e.respondWith(fetch(e.request).then(res => {
      if (res.ok) {
        //// Neoffice — same fix, and waitUntil so the write outlives the response.
        const copy = res.clone()
        e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copy)))
      }
      return res
    }).catch(() =>
      //// Neoffice — offline: the exact page first, then the app shell at /gym.
      caches.match(e.request).then(hit => hit || caches.match(SHELL))
    ))
  }
})
