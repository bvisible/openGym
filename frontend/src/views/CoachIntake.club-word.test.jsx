//// Neoffice — added file (no upstream equivalent).
// The consent screen carries the club's own word when the club wrote one (Gym Settings →
// "The club's word to the member", boot `coach.intro`) — and nothing of the kind otherwise.
// A club sells coaching: this is where it positions the AI as a help between two sessions
// with ITS coaches, in its own sentences.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHTML } from 'linkedom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CoachIntake from './CoachIntake.jsx'

const mocks = vi.hoisted(() => {
  const state = { intro: null, hosting: null, nav: vi.fn(), toast: vi.fn() }
  state.storeSnapshot = () => ({
    S: { coach: null },
    user: { id: 'u1' },
    config: { coach: { enabled: true, provider: 'nora', ...(state.intro ? { intro: state.intro } : {}), ...(state.hosting ? { hosting: state.hosting } : {}) } },
    coachLocal: null,
    update: vi.fn(),
  })
  state.uiSnapshot = () => ({ toast: state.toast })
  return state
})

vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector(mocks.storeSnapshot())
  useStore.getState = mocks.storeSnapshot
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const useUI = selector => selector ? selector(mocks.uiSnapshot()) : mocks.uiSnapshot()
  useUI.getState = mocks.uiSnapshot
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.nav, useSearchParams: () => [new URLSearchParams()] }))
vi.mock('../lib/coach-api.js', () => ({
  requestPlan: vi.fn(() => Promise.resolve({})),
  disclosure: vi.fn(() => Promise.resolve({ payer: 'instance', providerLabel: 'Nora', categories: ['profile'] })),
}))
vi.mock('../lib/demo.js', () => ({ DEMO: false }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false }))
vi.mock('../coach.css', () => ({}))

let dom, root, container
function installDom() {
  const parsed = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
  dom = parsed.window
  globalThis.window = dom
  globalThis.document = dom.document
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.navigator })
  for (const key of ['HTMLElement', 'Node', 'Element', 'Event', 'Blob']) globalThis[key] = dom[key]
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.getElementById('root')
  root = createRoot(container)
}
beforeEach(() => { vi.clearAllMocks() })
afterEach(async () => {
  if (root) { await act(async () => { root.unmount() }); root = null }
  container = null; dom = null; mocks.intro = null; mocks.hosting = null
})

const render = async () => { installDom(); await act(async () => { root.render(React.createElement(CoachIntake)) }) }

describe('the consent screen carries the club’s word', () => {
  it('shows the club’s sentences as they were written, before what the coach reads', async () => {
    mocks.intro = 'Un coup de pouce entre deux séances avec votre coach Olympia.'
    await render()
    const word = container.querySelector('.ob-club-word')
    expect(word?.textContent).toBe(mocks.intro)
    // Positioned right after our own introduction, ahead of the data list.
    expect(word.compareDocumentPosition(container.querySelector('.ob-consent')) & 4).toBeTruthy()
  })
  it('shows nothing of the kind when the club wrote none', async () => {
    await render()
    expect(container.querySelector('.ob-club-word')).toBeNull()
    expect(container.querySelector('.ob-consent')).not.toBeNull()
  })
})

describe('where the data goes is said by the server when it knows', () => {
  it('prints the server’s sentence instead of upstream’s "running on this server"', async () => {
    mocks.hosting = 'Envoyé à Nora, sur les serveurs de Neoservice.'
    await render()
    const fine = container.querySelector('.ob-fine').textContent
    expect(fine).toContain(mocks.hosting)
    expect(fine).not.toContain('running on this server')
  })
  it('keeps upstream’s sentence when the server said nothing', async () => {
    await render()
    expect(container.querySelector('.ob-fine').textContent).toContain('Nora')
  })
})
