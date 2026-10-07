//// Neoffice — Web Push on the club's own instance (07.10, upstream v1.3.10). Upstream's Node server kept the
//// subscriptions and sent the reminders; on Neoffice that server is neoffice_gym (api/push.py): the same five
//// calls under /api/method/neoffice_gym.api.push.*, through our api() (which adds Frappe's CSRF header and
//// unwraps its {message}). The device id travels as `device_id`, Frappe's spelling. The rest timer's push is
//// not sent (the journal keeps the screen awake for a workout instead): deviceId() is kept for the worker
//// and for the day it is.
// Web Push subscribe/unsubscribe — requires a signed-in profile (subscriptions are stored
// server-side per user, same as everything else under /api).
import { api, BOOT } from './api.js'

//// Neoffice — the endpoints (neoffice_gym/api/push.py); each resolves the member from the session.
const PUSH = '/api/method/neoffice_gym.api.push.'
export const PUSH_PATHS = {
  key: PUSH + 'public_key',
  subscribe: PUSH + 'subscribe',
  status: PUSH + 'status',
  unsubscribe: PUSH + 'unsubscribe',
  test: PUSH + 'test',
}

// main.jsx registers the service worker on https only, so on any other origin there is no
// worker and `navigator.serviceWorker.ready` never settles — the toggle looked usable and hung.
const secureOrigin = () => typeof location === 'undefined' || location.protocol === 'https:'
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && secureOrigin()
export const pushPermission = () => (pushSupported() ? Notification.permission : 'unsupported')

const urlBase64ToUint8Array = b64 => {
  const padded = (b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
const bytesToUrlBase64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// One token per browser profile, made up here and never shown: it tells the server which of
// the account's subscriptions belong to this device. Nothing identifying in it.
const DEVICE_KEY = 'gym_device'
// The shape the server keeps (neoffice_gym api/push.py DEVICE_ID): anything else it treats as no id
// at all. A stored value outside it (set by hand, or left by some other build) went out as it was,
// the row kept no id, and the boot sync sent it again on every boot. It is replaced like a missing one.
const DEVICE_ID_RULE = /^[A-Za-z0-9_-]{8,64}$/
export function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id || !DEVICE_ID_RULE.test(id)) {
      id = (crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')).replace(/-/g, '')
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch { return undefined }
}

// The worker re-registers a subscription the push service rotated (gym_sw.js, pushsubscriptionchange),
// usually with no page open, and it cannot read localStorage. It finds the device id here instead, in a
// cache of its own that its activate sweep leaves alone. Left every time this browser holds a
// subscription the server should have, so a browser subscribed before the worker looked for it has it
// by its next boot.
const DEVICE_CACHE = 'opengym-device'
const DEVICE_URL = '/opengym-device-id'
//// Neoffice — and the session's CSRF token beside it: Frappe refuses a POST without it, and the worker
//// has no page to read it from. Same origin only, like the page that already holds it; a token from an
//// older session is refused, and the page's next boot registers the subscription itself.
const CSRF_URL = '/opengym-csrf-token'
async function shareDeviceId() {
  const id = deviceId()
  if (!id) return
  //// Neoffice — the CSRF token goes into the worker's cache too (CSRF_URL, above).
  try {
    const cache = await caches.open(DEVICE_CACHE)
    await cache.put(DEVICE_URL, new Response(id))
    if (BOOT.csrf_token) await cache.put(CSRF_URL, new Response(BOOT.csrf_token))
  } catch { /* no Cache API: the worker sends none, as before */ }
}

// The worker is registered at boot; on https it is there within a moment, but a promise that
// never settles must not hang a settings screen or the boot path — give it a bounded wait.
const readyWorker = (ms = 8000) => Promise.race([
  navigator.serviceWorker.ready,
  new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker not ready')), ms))
])

//// Neoffice — the club's endpoint, the device id under Frappe's name (device_id).
const register = sub => api(PUSH_PATHS.subscribe, { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON(), device_id: deviceId() }) })

export async function enablePush() {
  if (!pushSupported()) throw new Error('Push notifications are not supported in this browser')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notifications permission was not granted')
  const reg = await readyWorker()
  //// Neoffice — the instance's VAPID key (api/push.py public_key).
  const { key } = await api(PUSH_PATHS.key)
  const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) })
  await shareDeviceId()
  await register(subscription)
}

export async function disablePush() {
  if (!pushSupported()) return
  const reg = await readyWorker()
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await sub.unsubscribe()
  //// Neoffice — the club's endpoint (PUSH_PATHS).
  await api(PUSH_PATHS.unsubscribe, { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {})
}

/* Brings the server's copy of this browser's subscription back in line with the browser's.
   Called once per signed-in boot and when Settings opens. The browser keeps its subscription
   //// Neoffice — the club's server keeps no db.json: its rows and its key are neoffice_gym's.
   through anything that happens on the server — a row pruned after a dead send, a regenerated
   key — and the toggle used to read "on" from the browser's side while nothing was ever going to
   arrive. Resolves to whether the server now holds it:
   - no permission or no subscription here → false, nothing to do;
   - the server already has this endpoint under this browser's device id → true, no write;
   - the server has it under no device id or another one → sent again with this one, true;
   - the server lost it → re-registered, true;
   - the server's key changed → the old subscription is useless; unsubscribe, subscribe against
     the new key, register, true.
   Network failures propagate — the caller decides what "unknown" means for it. */
export async function syncPushSubscription() {
  if (!pushSupported() || Notification.permission !== 'granted') return false
  const reg = await readyWorker()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) return false
  await shareDeviceId()
  //// Neoffice — the instance's VAPID key (PUSH_PATHS.key).
  const { key } = await api(PUSH_PATHS.key)
  const mine = sub.options?.applicationServerKey
  if (mine && key && bytesToUrlBase64(mine) !== key.replace(/=+$/, '')) {
    await sub.unsubscribe().catch(() => {})
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) })
    await register(sub)
    return true
  }
  //// Neoffice — the club's status endpoint answers device_id, Frappe's spelling.
  // A row the server stores under no device id, or another one, is sent again with this browser's: the
  // same endpoint and keys, and the server keeps the row. Such rows come from the worker re-sending a
  // rotated subscription with no id to hand.
  const { subscribed, device_id: storedAs } = await api(PUSH_PATHS.status + '?endpoint=' + encodeURIComponent(sub.endpoint))
  const id = deviceId()
  if (!subscribed || (id && storedAs !== undefined && storedAs !== id)) await register(sub)
  return true
}

//// Neoffice — the club's test endpoint (api/push.py test).
export const sendTestPush = () => api(PUSH_PATHS.test, { method: 'POST', body: '{}' })
