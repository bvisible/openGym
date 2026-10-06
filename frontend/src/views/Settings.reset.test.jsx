// @vitest-environment happy-dom
//// Neoffice — no photos or videos in the reset message: they never reach the club's server.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// "Reset everything" is one dialog with two truths. A guest's data lives in this browser only.
// A signed-in profile pushes the empty state to the server like any other change, so the wipe
// reaches every device that syncs with it — and the Coach's own files have to go too: the
// per-profile one on the server, and the device one when the Coach runs with the phone's own key.
const mocks = vi.hoisted(() => {
  const state = { S: null, user: null, coachLocal: null }
  state.replaceState = vi.fn()
  state.resetEverything = vi.fn()
  state.confirmSheet = vi.fn()
  state.forgetCoach = vi.fn(() => Promise.resolve({ ok: true }))
  state.api = vi.fn(() => Promise.resolve({ ok: true }))
  state.toast = vi.fn()
  state.snapshot = () => ({
    S: state.S,
    user: state.user,
    coachLocal: state.coachLocal,
    update: mut => {
      const next = structuredClone(state.S)
      mut(next)
      state.S = next
    },
    replaceState: state.replaceState, resetEverything: state.resetEverything, setUser: vi.fn(), pullState: vi.fn(), pushState: vi.fn(),
    signOut: vi.fn(), signOutAll: vi.fn(), resetDemo: vi.fn(), disconnectServer: vi.fn(),
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { reminder: { time: '17:30' }, workouts: [] }, hasData: () => false }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: (...a) => mocks.toast(...a), openSheet: vi.fn() })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
//// Neoffice — upstream's api.js mock knows its own exports only. Ours also
//// exports the club calls Settings makes at mount (the pass balance and the
//// coming classes, MyClub) and lib/push.js gained syncPushSubscription; left
//// out they are `undefined` and the screen throws in its first effect.
vi.mock('../lib/api.js', () => ({
  //// Neoffice — BOOT: the page's boot data (lib/api.js), read by our screens at import.
  BOOT: {},
  api: (...a) => mocks.api(...a), webauthnOK: () => false, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), IS_ANDROID: false,
  myCoach: vi.fn(() => Promise.resolve(null)), openChat: vi.fn(), wallet: vi.fn(() => Promise.resolve(null)), classesMine: vi.fn(() => Promise.resolve([])), myMembership: vi.fn(() => Promise.resolve({ shown: false })),
}))
vi.mock('../lib/push.js', () => ({ pushSupported: () => false, enablePush: vi.fn(), disablePush: vi.fn(), sendTestPush: vi.fn(), syncPushSubscription: vi.fn(() => Promise.resolve(false)) }))   //// Neoffice — syncPushSubscription: our push module exports it
vi.mock('../lib/wakelock.js', () => ({ wakeLockSupported: () => false }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false, isAndroid: () => Promise.resolve(false), shareExport: vi.fn(), syncReminder: vi.fn() }))
vi.mock('../lib/coach-api.js', () => ({ forgetCoach: (...a) => mocks.forgetCoach(...a) }))
vi.mock('./MobileOnboarding.jsx', () => ({ ConnectSheet: () => null }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), confirmSheet: (...a) => mocks.confirmSheet(...a), importFromApp: vi.fn(),
  importFromHevy: vi.fn(), equipmentProfileSheet: vi.fn(), menuSheet: vi.fn(),
}))

globalThis.__APP_VERSION__ ??= 'test'

let host, root
beforeEach(() => {
  mocks.S = {
    unit: 'kg', restSec: 90, restPauseSec: 15, sound: false, effort: 'none',
    gifSize: 'full', workouts: [], routines: [], exWeights: {},
  }
  mocks.user = null
  mocks.coachLocal = null
  mocks.replaceState.mockClear()
  mocks.resetEverything.mockClear()
  mocks.confirmSheet.mockClear()
  mocks.forgetCoach.mockClear()
  mocks.api.mockClear()
  mocks.toast.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const mount = () => act(() => root.render(<Settings />))
const resetRow = () => [...host.querySelectorAll('.lrow')].find(r => r.textContent.includes('Reset everything'))
const openDialog = () => {
  act(() => { resetRow().click() })
  expect(mocks.confirmSheet).toHaveBeenCalledTimes(1)
  return mocks.confirmSheet.mock.calls[0][0]
}
const serverForgetCalls = () => mocks.api.mock.calls.filter(([path]) => path === '/api/coach/forget')

describe('Settings — reset everything', () => {
  it('guest: says the wipe is local, resets to the defaults, never calls the Coach', () => {
    mount()
    const dialog = openDialog()
    expect(dialog.title).toBe('Reset everything?')
    expect(dialog.message).toBe('Deletes your plan, workouts and body weight on this device. This cannot be undone.')   //// Neoffice — our sentence: no photos or videos
    act(() => { dialog.onConfirm() })
    // the store's reset: the empty copy, stamped (useStore resetEverything)
    expect(mocks.resetEverything).toHaveBeenCalledTimes(1)
    expect(serverForgetCalls()).toHaveLength(0)
    expect(mocks.forgetCoach).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith('All data reset')
  })

  //// Neoffice — upstream POSTs /api/coach/forget to its Node server here and
  //// keeps forgetCoach() for a phone with its own key. On Neoffice the Coach is
  //// the club's Nora, reached the "local" way, and lib/coach-api.js routes
  //// forgetCoach() to the right home: ONE call, never a bare server path.
  it('signed in: says the wipe reaches the server and every device, and forgets the Coach through coach-api', () => {
    mocks.user = { uid: 'u1', name: 'Ana' }
    mount()
    const dialog = openDialog()
    expect(dialog.message).toBe('Deletes your plan, workouts and body weight from your profile on this server and on every signed-in device. This cannot be undone.')   //// Neoffice — our sentence: no photos or videos
    act(() => { dialog.onConfirm() })
    //// Neoffice — the Coach is the club's Nora: no /api/coach/forget, forgetCoach() is its one
    //// door; the reset itself is upstream's resetEverything (v1.3.9, it stamps resetAt).
    expect(serverForgetCalls()).toHaveLength(0)
    expect(mocks.forgetCoach).toHaveBeenCalledTimes(1)
    expect(mocks.resetEverything).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledWith('All data reset')
  })

  it('signed in: a failing Coach call does not block the reset', async () => {
    mocks.user = { uid: 'u1', name: 'Ana' }
    mocks.forgetCoach.mockRejectedValueOnce(new Error('offline'))   //// Neoffice — the one call that can fail here
    mount()
    const dialog = openDialog()
    await act(async () => { dialog.onConfirm(); await Promise.resolve() })
    expect(mocks.forgetCoach).toHaveBeenCalledTimes(1)   //// Neoffice — the Coach's one door, coach-api
    expect(mocks.resetEverything).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledWith('All data reset')
  })

  // A paired phone running the Coach with its own key has Coach data in both homes.
  it('paired phone with its own key: clears the Coach once, through coach-api', () => {   //// Neoffice — the Coach's one door, coach-api
    mocks.user = { uid: 'u1', name: 'Ana' }
    mocks.coachLocal = { mode: 'byok', provider: 'anthropic' }
    mount()
    const dialog = openDialog()
    act(() => { dialog.onConfirm() })
    expect(serverForgetCalls()).toHaveLength(0)   //// Neoffice — see above: no bare server path
    expect(mocks.forgetCoach).toHaveBeenCalledTimes(1)
    expect(mocks.resetEverything).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledWith('All data reset')
  })

  it('own key, no server: clears the device Coach without touching the server', () => {
    mocks.coachLocal = { mode: 'byok', provider: 'anthropic' }
    mount()
    const dialog = openDialog()
    act(() => { dialog.onConfirm() })
    expect(serverForgetCalls()).toHaveLength(0)
    expect(mocks.forgetCoach).toHaveBeenCalledTimes(1)
    expect(mocks.resetEverything).toHaveBeenCalledTimes(1)
  })
})

describe('Settings — footer', () => {
  it('links the source code to its home on GitHub', () => {
    mount()
    const link = [...host.querySelectorAll('a')].find(a => a.textContent === 'source code')
    expect(link.getAttribute('href')).toBe('https://github.com/bvisible/openGym')  //// Neoffice — our fork's source (AGPL)
  })
})
