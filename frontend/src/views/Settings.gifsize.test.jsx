// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null }
  state.snapshot = () => ({
    S: state.S,
    user: null,
    update: mut => {
      const next = structuredClone(state.S)
      mut(next)
      state.S = next
    },
    replaceState: vi.fn(), setUser: vi.fn(), pullState: vi.fn(), pushState: vi.fn(),
    signOut: vi.fn(), signOutAll: vi.fn(), resetDemo: vi.fn(), disconnectServer: vi.fn(),
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { reminder: { time: '17:30' } }, hasData: () => false, isSimple: () => false,
  atLeast: () => true, levelOf: () => 'full' }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: vi.fn(), openSheet: vi.fn() })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../lib/api.js', () => ({
  api: vi.fn(), webauthnOK: () => false, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), IS_ANDROID: false,
  //// Neoffice — our store imports named helpers from api.js (the journal is
  //// served from Frappe and calls whitelisted methods). Absent from the mock
  //// they come back undefined, and the store falls through to the REAL module
  //// — the test then tries to reach localhost:3000 and fails on ECONNREFUSED,
  //// which says nothing about what it was testing.
  getState: vi.fn(() => Promise.resolve({ state: null })),
  putState: vi.fn(() => Promise.resolve({})),
  logout: vi.fn(() => Promise.resolve({})),
  currentUser: () => null,
  setRemoteAuth: () => {},
  wallet: vi.fn(() => Promise.resolve({})),
  myCoach: vi.fn(() => Promise.resolve({})),
  openChat: vi.fn(() => Promise.resolve({})),
  classesMine: vi.fn(() => Promise.resolve({ classes: [] })),
}))
vi.mock('../lib/push.js', () => ({ pushSupported: () => false, enablePush: vi.fn(), disablePush: vi.fn(), sendTestPush: vi.fn() }))
vi.mock('../lib/wakelock.js', () => ({ wakeLockSupported: () => false }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false, shareExport: vi.fn(), syncReminder: vi.fn() }))
vi.mock('./MobileOnboarding.jsx', () => ({ ConnectSheet: () => null }))
vi.mock('../sheets.jsx', () => ({
  loadStarterPlan: vi.fn(), confirmSheet: vi.fn(), importFromApp: vi.fn(),
  importFromHevy: vi.fn(), equipmentProfileSheet: vi.fn(),
}))

// The Settings view reads the build-time version constant at render time.
globalThis.__APP_VERSION__ ??= 'test'

let host, root
beforeEach(() => {
  mocks.S = {
    unit: 'kg', restSec: 90, restPauseSec: 15, sound: false, effort: 'none',
    gifSize: 'full', workouts: [], routines: [], exWeights: {},
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const mount = () => act(() => root.render(<Settings />))
const segButton = label => [...host.querySelectorAll('.seg button')].find(b => b.textContent === label)

describe('Settings — exercise animations', () => {
  it('offers Full / Small / Hidden and writes gifSize to the store', () => {
    mount()
    expect(segButton('Full')).toBeTruthy()
    expect(segButton('Small')).toBeTruthy()
    expect(segButton('Hidden')).toBeTruthy()
    expect(segButton('Full').getAttribute('aria-pressed')).toBe('true')
    act(() => { segButton('Hidden').click() })
    expect(mocks.S.gifSize).toBe('off')
    mount()
    expect(segButton('Hidden').getAttribute('aria-pressed')).toBe('true')
    act(() => { segButton('Small').click() })
    expect(mocks.S.gifSize).toBe('mini')
  })

  it('shows a legacy/absent value as Full', () => {
    delete mocks.S.gifSize
    mount()
    expect(segButton('Full').getAttribute('aria-pressed')).toBe('true')
    expect(segButton('Hidden').getAttribute('aria-pressed')).toBe('false')
  })
})
