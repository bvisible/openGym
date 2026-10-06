// @vitest-environment happy-dom
//// Neoffice — upstream's v1.3.9 test of the connection indicator, on our journal. Kept: every state a
//// club's journal can be in, with upstream's words. Removed: pairing a phone, passkey sign-in and the
//// guest's local mode, which this fork does not ship. Changed: « Sign in » renders the page again
//// (ServerSync.signInAgain, lib/api.js reloadJournal), and on the sign-in screen the line has
//// nothing to press — the form is right there.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SyncBanner, { PENDING_GRACE_MS } from './SyncBanner.jsx'
import { connectionView } from './ServerSync.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* The connection indicator: every way the app can be without its server gets a line that stays
   while the condition lasts — offline, an error with its HTTP code, a server that refuses this
   device, an answer that is not openGym's — and says what to do about it. Never in the public demo,
   //// Neoffice — upstream also lists « no server at all »: a club's journal always has one.
   and a change merely waiting for its push does not flash it. The store is a stand-in: its `sync`
   is what each test sets; ServerSync.jsx (the words and the actions) is the real one. */
const mocks = vi.hoisted(() => {
  const state = { MOBILE: false, DEMO: false, user: null, guest: false, onboarding: false, sync: null }   //// Neoffice — no passkeys, sheets or navigation to record
  state.toast = vi.fn()
  state.syncNow = vi.fn(async () => state.sync)
  state.reload = vi.fn()   //// Neoffice — the page rendered again (lib/api.js reloadJournal)
  state.snapshot = () => ({
    user: state.user, sync: state.sync, needsMobileOnboarding: state.onboarding,
    isGuest: () => state.guest, syncNow: state.syncNow,   //// Neoffice — no setUser / adoptProfile: no passkey sign-in here
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: (...a) => mocks.toast(...a), openSheet: () => ({}) })   //// Neoffice — no sheet opened: no connect sheet here
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
//// Neoffice — no router, no api passkeys, no sheets, no MobileOnboarding mocks: not imported any more
})
vi.mock('../lib/mobile.js', () => ({ get MOBILE() { return mocks.MOBILE } }))
vi.mock('../lib/demo.js', () => ({ get DEMO() { return mocks.DEMO } }))
vi.mock('../lib/api.js', () => ({ BOOT: {}, reloadJournal: (...a) => mocks.reload(...a) }))   //// Neoffice — reloadJournal stands in for the page reload

const sync = (status, extra = {}) => ({ status, offline: false, pending: false, auth: false, lastError: null, lastSynced: 0, server: null, ...extra })   //// Neoffice — no server address: the club's journal has none

// Whether the device has a network (navigator.onLine), and the event that says it changed.
const network = on => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => on })
  window.dispatchEvent(new Event(on ? 'online' : 'offline'))
}

let host, root
beforeEach(() => {
  network(true)
  Object.assign(mocks, { MOBILE: false, DEMO: false, user: { id: 'u1', name: 'andi' }, guest: false, onboarding: false, sync: sync('ok') })   //// Neoffice — no webauthn flag, no sheets or navs to reset
  mocks.toast.mockClear(); mocks.syncNow.mockClear(); mocks.reload.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.useRealTimers()
})

const render = () => act(() => root.render(<SyncBanner />))
const bar = () => host.querySelector('.conn-bar')
const text = () => host.querySelector('.conn-t')?.textContent || null
const button = () => host.querySelector('button.conn')
const label = () => host.querySelector('.conn-a')?.textContent || null
const conn = () => document.documentElement.style.getPropertyValue('--conn')   //// Neoffice — no connect-sheet helper: no pairing here

describe('connected and in step', () => {
  it('shows nothing, and leaves the page its full height', () => {
    render()
    expect(bar()).toBeNull()
    expect(conn()).toBe('')
  })

  it('the device going offline is said at once, not at the next sync attempt, and goes when it is back', async () => {
    render()
    expect(bar()).toBeNull()
    act(() => network(false))
    expect(text()).toBe('Offline — showing the last copy synced with the server.')
    expect(bar().className).toContain('off')
    expect(label()).toBe('Try again')
    expect(connectionView(sync('ok'), { online: false }).line).toBe('Offline — the server cannot be reached')
    act(() => network(true))
    expect(bar()).toBeNull()
  })

  it('a change waiting while the device is offline says it is kept here, after the same grace as ever', () => {
    vi.useFakeTimers()
    network(false)
    mocks.sync = sync('pending', { pending: true })
    render()
    expect(bar()).toBeNull()
    act(() => { vi.advanceTimersByTime(PENDING_GRACE_MS) })
    expect(text()).toBe('Offline — your changes are saved on this device and sync when you are back online.')
  })
})

describe('not connected — it says so, and what to do', () => {
  it('offline with changes waiting: kept on this device, and a retry that reports back', async () => {
    network(false)
    mocks.sync = sync('offline', { offline: true, pending: true, lastError: { status: 0, code: 'network' } })
    render()
    expect(text()).toBe('Offline — your changes are saved on this device and sync when you are back online.')
    expect(bar().className).toContain('off')
    expect(label()).toBe('Try again')
    // Its row's height is what the page and the pinned headers leave free.
    expect(conn()).not.toBe('')
    await act(async () => { button().click() })
    expect(mocks.syncNow).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledWith('Offline — the server cannot be reached')
  })

  it('offline with nothing waiting: the copy on screen is the last synced one', () => {
    network(false)
    mocks.sync = sync('offline', { offline: true, lastError: { status: 0, code: 'timeout' } })
    render()
    expect(text()).toBe('Offline — showing the last copy synced with the server.')
  })

  it('the server out of reach while the device is online is the server, not the device', async () => {
    mocks.sync = sync('offline', { offline: true, pending: true, lastError: { status: 0, code: 'network' } })
    render()
    expect(text()).toBe('Your server cannot be reached — your changes are saved on this device and sync once it answers again.')
    expect(bar().className).toContain('off')   //// Neoffice — retry's toast checked below, as upstream
    await act(async () => { button().click() })
    expect(mocks.toast).toHaveBeenCalledWith('The server cannot be reached')
  })

  it('a request that never answered says so in Settings and in the toast', async () => {   //// Neoffice — added: the timeout line (lib/api.js limits)
    mocks.sync = sync('offline', { offline: true, lastError: { status: undefined, code: 'timeout' } })
    expect(connectionView(mocks.sync, { online: true }).line).toBe('The server did not answer in time.')
  })

  it('with nothing waiting it shows the last copy, and the words follow the network as it goes and comes', () => {
    mocks.sync = sync('offline', { offline: true, lastError: { status: 0, code: 'network' } })
    render()
    expect(text()).toBe('Your server cannot be reached — showing the last copy synced with it.')
    act(() => network(false))
    expect(text()).toBe('Offline — showing the last copy synced with the server.')
    act(() => network(true))
    expect(text()).toBe('Your server cannot be reached — showing the last copy synced with it.')
  })

  it('a server error carries its HTTP code, for whoever runs the server', () => {
    mocks.sync = sync('error', { pending: true, lastError: { status: 502, code: 'http' } })
    render()
    expect(text()).toBe('Your server answered with an error (HTTP 502). Your changes are kept here.')
    expect(bar().className).toContain('bad')
  })

  it('an answer that is not the server\'s (a Wi-Fi sign-in page) is named as such', () => {   //// Neoffice — our words: the Wi-Fi sign-in page is the case a club member meets
    mocks.sync = sync('error', { lastError: { status: 200, code: 'bad-response' } })
    render()
    expect(text()).toBe('Your server’s address answered with something other than openGym (HTTP 200). Your changes are kept here.')
  })

  it('a session that ended mid-use: « Sign in » renders the page again, which shows the sign-in screen', async () => {   //// Neoffice — ours: « Sign in » renders the page again
    mocks.sync = sync('auth', { auth: true, pending: true, lastError: { status: 403, code: 'auth' } })
    render()
    expect(text()).toBe('Your server no longer accepts this browser. Your changes are kept here.')
    expect(label()).toBe('Sign in')
    await act(async () => { button().click() })
    expect(mocks.reload).toHaveBeenCalledTimes(1)   //// Neoffice — the page rendered again, not a passkey prompt
  })

  it('on the sign-in screen after the session ended, it says the changes are still here, with nothing to press', () => {   //// Neoffice — ours: on the sign-in screen the form is right there
    mocks.user = null
    mocks.sync = sync('auth', { auth: true, lastError: { status: 401, code: 'auth' } })
    render()
    expect(text()).toBe('Your server no longer accepts this browser. Your changes are kept here.')   //// Neoffice — no button: nothing to press
    expect(button()).toBeNull()
  })

  it('the sign-in screen of a browser nobody signed in on is left alone', () => {
    mocks.user = null
    mocks.sync = sync('local')
    render()
    expect(bar()).toBeNull()
  })
})

describe('a sign-in waiting for its question', () => {
  it('says nothing syncs until it is answered, and the tap runs Sync now, which asks it', () => {
    mocks.sync = sync('held')
    render()
    expect(text()).toBe('Nothing syncs until you say whether this device’s workouts go into your profile — tap to answer.')
    expect(connectionView(sync('held')).line).toBe('Waiting for your answer about this device’s workouts')
    act(() => { button().click() })
    expect(mocks.syncNow).toHaveBeenCalled()
  })
})

describe('where it never shows', () => {
  it('the public demo, which has no server by design', () => {
    mocks.DEMO = true
    mocks.sync = sync('offline', { offline: true, lastError: { status: 0, code: 'network' } })   //// Neoffice — the demo never shows it, whatever the state
    render()
    expect(bar()).toBeNull()
  })
})

describe('a change waiting while the server is reachable', () => {
  it('does not flash: only a wait longer than the grace period is shown', () => {
    vi.useFakeTimers()
    mocks.sync = sync('pending', { pending: true })
    render()
    expect(bar()).toBeNull()
    act(() => { vi.advanceTimersByTime(PENDING_GRACE_MS - 100) })
    expect(bar()).toBeNull()
    act(() => { vi.advanceTimersByTime(200) })
    expect(text()).toBe('Not synced yet — tap to retry.')
    expect(label()).toBeNull()   // the sentence already says "tap to retry"
  })

  it('a push that lands inside the grace period never shows it at all', () => {
    vi.useFakeTimers()
    mocks.sync = sync('pending', { pending: true })
    render()
    act(() => { vi.advanceTimersByTime(PENDING_GRACE_MS / 2) })
    mocks.sync = sync('ok', { lastSynced: Date.now() })
    render()
    act(() => { vi.advanceTimersByTime(PENDING_GRACE_MS) })
    expect(bar()).toBeNull()
    expect(conn()).toBe('')
  })
})
