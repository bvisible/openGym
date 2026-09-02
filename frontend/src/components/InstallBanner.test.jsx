// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// The banner itself: what it shows, when it is silent, and that "later"
//// is remembered. The decision logic has its own tests in lib/install-offer.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ BOOT: { app_title: 'Olympia', app_icon: '/files/olympia-icon-512.png' } }))

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Mobile/15E148 Safari/604.1'
let root, host

const mount = async (env) => {
  //// readEnvironment is what touches window; it is replaced per test so the
  //// component sees a phone, or an installed app, without a real device.
  vi.doMock('../lib/install-offer.js', async (importOriginal) => {
    const mod = await importOriginal()
    return { ...mod, readEnvironment: () => ({ ua: IOS, standalone: false, dismissedAt: null, now: Date.now(), ...env }) }
  })
  const { default: InstallBanner } = await import('./InstallBanner.jsx')
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<InstallBanner />) })
  return host
}

beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.resetModules(); localStorage.clear() })
afterEach(async () => { await act(async () => { root?.unmount() }); document.body.innerHTML = '' })

describe('the add-to-home-screen card', () => {
  it('names the club and shows its icon, on a phone in the browser', async () => {
    const h = await mount({})
    expect(h.textContent).toContain('Olympia')
    expect(h.querySelector('.install-mark img')?.getAttribute('src')).toBe('/files/olympia-icon-512.png')
    expect(h.textContent).toContain('Install')
  })

  it('draws nothing once the app is installed', async () => {
    const h = await mount({ standalone: true })
    expect(h.querySelector('.install-banner')).toBeNull()
  })

  it('"later" removes the card and is remembered for next time', async () => {
    const { DISMISS_KEY } = await import('../lib/install-offer.js')
    const h = await mount({})
    const later = h.querySelector('button[aria-label="Later"]')
    expect(later, 'no Later button').not.toBeNull()
    await act(async () => { later.click() })
    expect(h.querySelector('.install-banner')).toBeNull()
    expect(Number(localStorage.getItem(DISMISS_KEY))).toBeGreaterThan(0)
  })
})
