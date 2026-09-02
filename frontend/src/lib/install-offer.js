//// Neoffice — added file (no upstream equivalent).
////
//// WHETHER TO OFFER "ADD TO HOME SCREEN", AND HOW.
////
//// Jérémy, 02.09: *"on ne peut pas avoir un message quand on arrive dessus
//// sur un smartphone et qu'on est encore dans le navigateur ? Une sorte de
//// petit pop-up qui invite et qui explique comment faire."*
////
//// The decision is a pure function of the environment, and it is kept apart
//// from the banner that draws it because the environment is exactly what a
//// test cannot fake through a component: the user agent, display-mode, the
//// date of the last "later". So it takes them as arguments.
////
//// What decides:
////   * a PHONE — the journal is used at the rack; on a desktop the offer is
////     noise, and desktop Chrome's "install" makes a window nobody asked for;
////   * NOT already installed — `display-mode: standalone` (Android, Chrome)
////     or `navigator.standalone` (iOS Safari): once installed, never again;
////   * NOT declined in the last 14 days — "later" must mean later, not "every
////     morning until you give in".
////
//// How to install differs per platform, and the banner needs to know:
////   * Android Chrome fires `beforeinstallprompt`, which we capture early
////     (see `captureInstallPrompt`) and replay from a button — a REAL install;
////   * iOS has no such event: Share → "Add to Home Screen", explained in words;
////   * anything else gets the generic "browser menu" wording.

export const DISMISS_DAYS = 14
export const DISMISS_KEY = 'gym_install_dismissed_at'

//: Held here, module-level: the event fires ONCE, early, and a component
//: mounted later cannot catch it. `captureInstallPrompt` must run at boot.
let deferredPrompt = null

export function captureInstallPrompt(win = typeof window !== 'undefined' ? window : null) {
  if (!win || !win.addEventListener) return
  win.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferredPrompt = e
  })
  win.addEventListener('appinstalled', () => { deferredPrompt = null })
}

export const hasNativePrompt = () => Boolean(deferredPrompt)

export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable'
  const ev = deferredPrompt
  deferredPrompt = null
  ev.prompt()
  const choice = await ev.userChoice.catch(() => ({ outcome: 'dismissed' }))
  return choice?.outcome || 'dismissed'
}

export function platformOf(ua = '') {
  const s = String(ua)
  if (/iPhone|iPad|iPod/i.test(s)) return 'ios'
  if (/Android/i.test(s)) return 'android'
  return 'other'
}

/**
 * @param {object} env
 * @param {string} env.ua           navigator.userAgent
 * @param {boolean} env.standalone  display-mode standalone / navigator.standalone
 * @param {number|null} env.dismissedAt  ms timestamp of the last "later", or null
 * @param {number} env.now          ms timestamp
 * @returns {{ show: boolean, platform: 'ios'|'android'|'other', reason: string }}
 */
export function installOffer({ ua = '', standalone = false, dismissedAt = null, now = Date.now() } = {}) {
  const platform = platformOf(ua)
  if (platform === 'other') return { show: false, platform, reason: 'not a phone' }
  if (standalone) return { show: false, platform, reason: 'already installed' }
  if (dismissedAt && now - dismissedAt < DISMISS_DAYS * 86400e3) {
    return { show: false, platform, reason: 'declined recently' }
  }
  return { show: true, platform, reason: 'ok' }
}

//// What the browser actually says about itself. Read once per render of the
//// banner; wrapped so a test never has to touch `window`.
export function readEnvironment(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return { ua: '', standalone: false, dismissedAt: null, now: Date.now() }
  let dismissedAt = null
  try { dismissedAt = Number(win.localStorage.getItem(DISMISS_KEY)) || null } catch { /* private mode */ }
  const standalone = Boolean(
    (win.matchMedia && win.matchMedia('(display-mode: standalone)').matches) ||
    win.navigator?.standalone
  )
  return { ua: win.navigator?.userAgent || '', standalone, dismissedAt, now: Date.now() }
}

export function dismissInstallOffer(win = typeof window !== 'undefined' ? window : null) {
  try { win?.localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* private mode */ }
}
