// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// The decision to offer "add to home screen". Pure: the environment comes in
//// as arguments, so every branch that would otherwise need a real phone is a
//// one-liner here.
import { describe, expect, it, vi } from 'vitest'
import { installOffer, platformOf, DISMISS_DAYS, captureInstallPrompt, hasNativePrompt, promptInstall } from './install-offer.js'

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const DAY = 86400e3
const now = Date.parse('2026-09-02T09:00:00Z')

describe('who gets the offer', () => {
  it('a phone in the browser: yes, with its platform', () => {
    expect(installOffer({ ua: IOS, now })).toMatchObject({ show: true, platform: 'ios' })
    expect(installOffer({ ua: ANDROID, now })).toMatchObject({ show: true, platform: 'android' })
  })

  it('a desktop: never — the journal is used at the rack', () => {
    expect(installOffer({ ua: MAC, now }).show).toBe(false)
  })

  it('already installed: never again', () => {
    //// display-mode: standalone (Android) or navigator.standalone (iOS) both
    //// arrive here as one boolean. Once on the home screen, the offer would be
    //// asking somebody to do what they just did.
    expect(installOffer({ ua: IOS, standalone: true, now }).show).toBe(false)
    expect(installOffer({ ua: ANDROID, standalone: true, now }).show).toBe(false)
  })
})

describe('"later" means later', () => {
  it('stays quiet for two weeks after a dismissal', () => {
    expect(installOffer({ ua: IOS, dismissedAt: now - 3 * DAY, now }).show).toBe(false)
    expect(installOffer({ ua: IOS, dismissedAt: now - (DISMISS_DAYS - 1) * DAY, now }).show).toBe(false)
  })

  it('comes back after two weeks', () => {
    expect(installOffer({ ua: IOS, dismissedAt: now - (DISMISS_DAYS + 1) * DAY, now }).show).toBe(true)
  })
})

describe('platform detection', () => {
  it('reads iPad and iPod as iOS too', () => {
    expect(platformOf('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)')).toBe('ios')
  })
  it('an empty or unknown agent is not a phone', () => {
    expect(platformOf('')).toBe('other')
  })
})

describe('the native Android prompt', () => {
  it('is captured early and replayed from the button', async () => {
    const listeners = {}
    const win = { addEventListener: (n, fn) => { listeners[n] = fn } }
    captureInstallPrompt(win)
    expect(hasNativePrompt()).toBe(false)
    const ev = { preventDefault: vi.fn(), prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) }
    listeners.beforeinstallprompt(ev)
    //// preventDefault is the whole trick: without it Chrome shows its own
    //// mini-bar at a moment of its choosing, and the button has nothing left.
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(hasNativePrompt()).toBe(true)
    expect(await promptInstall()).toBe('accepted')
    expect(ev.prompt).toHaveBeenCalled()
    //: Consumed: a prompt can be shown once.
    expect(hasNativePrompt()).toBe(false)
    expect(await promptInstall()).toBe('unavailable')
  })
})
