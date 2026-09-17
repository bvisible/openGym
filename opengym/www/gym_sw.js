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
//// ⚠️ Keep in step with frontend/public/sw.js: the two differ ONLY in this
//// header and in SHELL ('/gym' here, 'index.html' there). Generating this file
//// from the build is one npm script away, worth doing the day the caching
//// strategy changes again — src/sw.session.test.js reads both meanwhile.

/* openGym service worker — the app shell and its hashed assets are cached at install and kept
   fresh network-first, media (img/gif) cache-first. A home-screen app reopened without a network
   comes back from here with the same bundle it last ran; the state itself lives in localStorage.
   Every deploy is a new worker with its own cache and the previous build's files are dropped on
   activate. */
//// Neoffice — v3 (v2 shipped the signed-out-shell fix below, v1 was upstream's):
//// the strategy changed with upstream v1.3.7 — the shell and its assets are
//// now precached at install — and a new name is what makes activate drop what
//// phones hold under the old one. A FIXED name rather than upstream's
//// `__BUILD__` stamp, on purpose: this file is served as is by Frappe (no build
//// rewrites it), and src/sw.session.test.js pins both copies to one name.
const CACHE = 'opengym-rt-v3'
//// Neoffice — where the app shell lives. Upstream serves index.html next to
//// this worker; on Neoffice the shell is rendered by Frappe at /gym (see the
//// header of opengym/www/gym_sw.js) and carries the member's boot payload.
const SHELL = '/gym'

// What the shell needs to boot without a network: the shell itself plus every script/style/icon
// it references. Read from the served shell so the list follows the build, not a hand-kept
// manifest that would go stale the first time a chunk is renamed.
async function precache() {
  const c = await caches.open(CACHE)
  const res = await fetch(SHELL, { cache: 'no-cache' })
  if (!res.ok) return
  const html = await res.clone().text()
  //// Neoffice — through the same rule as a runtime fetch: a shell rendered
  //// signed-out is not kept, its scripts, styles and icons are (they carry no
  //// session, and the next signed-in launch needs them offline).
  await cacheIfUsable(new Request(SHELL), res)
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1])
    .filter(u => /\.(?:js|css|png|svg|webmanifest|json)(?:\?|$)/.test(u) && !/^(?:https?:)?\/\//.test(u))
  await Promise.all([...new Set(refs)].map(u => c.add(u).catch(() => {})))
}

self.addEventListener('install', e => {
  e.waitUntil(precache().catch(() => {}).then(() => self.skipWaiting()))
})
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()))
})

// The payload is parsed inside waitUntil: a push whose handler throws before showing anything is
// a "silent push", which Chrome counts against the site and eventually revokes. A body that is
// not JSON still shows a notification.
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let data = {}
    try { data = e.data ? e.data.json() : {} } catch { data = { body: (() => { try { return e.data.text() } catch { return '' } })() } }
    // One alert per kind: a new rest-timer push replaces the last one instead of stacking
    // up in the tray (issue #172). `tag` alone should do that, but iOS keeps every one, so
    // the previous notification with the same tag is closed by hand first.
    const tag = data.tag || 'opengym'
    try { for (const n of await self.registration.getNotifications({ tag })) n.close() } catch {}
    await self.registration.showNotification(data.title || 'openGym', {
      body: data.body || '',
      icon: 'icon-512.png',
      badge: 'icon-180.png',
      tag,
      renotify: true
    })
  })())
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(clients => {
    const c = clients.find(c => 'focus' in c)
    return c ? c.focus() : self.clients.openWindow('./')
  }))
})
// The push service rotated the subscription (key change, expiry): subscribe again with the same
// server key and tell the server, so the row it holds keeps pointing at this browser.
//// Neoffice — inert here (nothing subscribes while lib/push.js reports push as
//// unsupported); kept in step with upstream so the day push arrives it is
//// already handled.
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil((async () => {
    const old = e.oldSubscription || (await self.registration.pushManager.getSubscription())
    const key = e.newSubscription?.options?.applicationServerKey || old?.options?.applicationServerKey
    if (!key) return
    const sub = e.newSubscription || await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    await fetch('api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) }).catch(() => {})
  })())
})

//// Neoffice — THE SHELL IS CACHED ONLY WHEN SOMEBODY IS SIGNED IN.
////
//// Reported 2026-09-01: *"ce matin j'ai relancé l'application et j'étais à
//// nouveau déconnecté"*, from the installed PWA. The session was never the
//// problem — the cookie carries Max-Age=2592000 and survived every purge that
//// was tried. What signs a member out is THIS CACHE.
////
//// /gym is rendered by Frappe and carries the boot payload: the member's name
//// and CSRF token, or `"user": null` for a guest. The handler below cached it
//// like any other page. So one launch that happened to render signed-out (an
//// expired session, a bad moment) wrote a signed-out shell into the cache, and
//// the next launch that started before the network was up — a phone waking on
//// Wi-Fi, every morning — was served that shell and showed the app signed out
//// while the cookie was perfectly valid.
////
//// 🔴 2026-09-02: this fix was first written into frontend/public/sw.js only,
//// with a test reading that file — and that file is the standalone build's
//// copy, which Frappe never serves. The bug stayed live on every phone for a
//// day while the test was green. The test now reads BOTH files, and asserts
//// both carry the same cache name.
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
        //// Neoffice — clone before anything else can read the body, and
        //// waitUntil so the write outlives the response (upstream's put was
        //// racing the worker going to sleep).
        if (res.ok) { const copy = res.clone(); e.waitUntil(c.put(e.request, copy)) }
        return res
      })
    )))
    return
  }
  // Network first; the copy for the cache is cloned before the response is handed to the page —
  // cloning later, once the page has started reading the body, throws and caches nothing, which
  // is why the shell never used to survive an offline reload.
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) {
      //// Neoffice — through cacheIfUsable: a signed-out shell must never be written.
      const copy = res.clone()
      e.waitUntil(cacheIfUsable(e.request, copy))
    }
    return res
  }).catch(() =>
    //// Neoffice — offline: the exact page first (query string ignored — a
    //// `?v=` stamped asset is the same file), then the app shell for a
    //// navigation, nothing for anything else.
    caches.match(e.request, { ignoreSearch: true }).then(hit =>
      hit || (e.request.mode === 'navigate' ? caches.match(SHELL) : undefined)
    )
  ))
})
