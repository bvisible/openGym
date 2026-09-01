/* openGym service worker — runtime caching (works with Vite's hashed asset names).
   Media (img/gif) cache-first; everything else network-first with offline fallback. */
//// Neoffice — bumped to v2 to DROP what is already out there. The activate
//// handler deletes every cache whose name is not the current one, so the
//// rename is what evicts the signed-out shells already sitting on members'
//// phones. Without it the fix ships and the symptom stays.
const CACHE = 'opengym-rt-v2'

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

//// Neoffice — added. Caches a response, unless it is an app shell rendered for
//// a signed-out visitor. Reads the clone as text rather than trusting the URL:
//// the shell is served at /gym, but also at /gym/ and with query strings, and
//// a check on the path alone has already been wrong here.
async function cacheIfUsable(request, response) {
  const type = response.headers.get('content-type') || ''
  if (type.includes('text/html')) {
    const body = await response.clone().text()
    //// The boot payload prints `"user": null` for a guest. Anything else —
    //// including a page with no boot at all — is cached as before.
    if (/"user":\s*null/.test(body)) return
  }
  const c = await caches.open(CACHE)
  return c.put(request, response)
}


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
        //// 🔴 …but NEVER cache a SIGNED-OUT shell.
        ////
        //// /gym is rendered by Frappe and carries the session: the boot payload
        //// holds the member's name and the CSRF token, or `"user": null` when
        //// nobody is signed in. Cached as an ordinary page, a signed-out shell
        //// becomes the offline fallback — and the next launch that starts
        //// before the network is up (a phone waking on Wi-Fi, every morning)
        //// is served it, showing the app SIGNED OUT while the cookie is still
        //// perfectly valid.
        ////
        //// Reported 2026-09-01: "ce matin j'ai relancé l'application et j'étais
        //// à nouveau déconnecté". The session itself was never the problem —
        //// measured 30 days on the cookie, surviving clear-cache, session purge,
        //// concurrent logins and a bench restart.
        ////
        //// So the shell is cached only when it carries a signed-in boot. Worst
        //// case there is simply no offline shell until the member opens the app
        //// online once, which is the honest failure: no fallback beats a
        //// fallback that signs people out.
        e.waitUntil(cacheIfUsable(e.request, copy))
      }
      return res
    }).catch(() =>
      //// Neoffice — offline: the exact page first, then the app shell at /gym.
      caches.match(e.request).then(hit => hit || caches.match(SHELL))
    ))
  }
})
