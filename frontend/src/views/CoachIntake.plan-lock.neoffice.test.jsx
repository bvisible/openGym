//// Neoffice — added file (no upstream equivalent).
// The Coach's questionnaire exists to build a plan. A member the Coach may not write one for (the
// club's switch, BOOT.coach.can.writePrograms, or the club writing this member's plan,
// can.changePlan) consents and goes to the chat: the seven questions used to follow the consent
// and end on a refused plan request. And a member whose plan the club writes is not told, on the
// way in, that the Coach designs it (seen in Chrome on 08.10).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHTML } from 'linkedom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CoachIntake from './CoachIntake.jsx'
import { BOOT } from '../lib/api.js'

const mocks = vi.hoisted(() => {
  const state = { S: null, nav: vi.fn(), toast: vi.fn() }
  state.storeSnapshot = () => ({
    S: state.S,
    user: { id: 'u1' },
    config: { coach: { enabled: true, provider: 'nora' } },
    coachLocal: null,
    update: mut => mut(state.S),
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
  disclosure: vi.fn(() => Promise.resolve({ payer: 'instance', providerLabel: 'Nora', categories: ['plan'] })),
  JOB_ERRORS: {},
}))
vi.mock('../lib/api.js', () => ({ BOOT: { coach: {} }, api: vi.fn(() => Promise.resolve({})) }))
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
beforeEach(() => { vi.clearAllMocks(); mocks.S = { coach: null, routines: [], workouts: [] } })
afterEach(async () => {
  if (root) { await act(async () => { root.unmount() }); root = null }
  container = null; dom = null; BOOT.coach = {}
})

const render = async () => { installDom(); await act(async () => { root.render(React.createElement(CoachIntake)) }) }
const agree = async () => {
  const button = [...container.querySelectorAll('button')].find(b => /I understand, let’s go/.test(b.textContent))
  expect(button).toBeTruthy()
  await act(async () => { button.dispatchEvent(new dom.Event('click', { bubbles: true })) })
}

describe('the way into the Coach, when it may not write the plan', () => {
  it('asks the questionnaire after the consent when the Coach may write a plan', async () => {
    //: The proof the cases below would otherwise see the questions.
    BOOT.coach = { can: { writePrograms: true, changePlan: true } }
    await render()
    expect(container.textContent).toContain('It designs your plan from a few answers')
    await agree()
    expect(container.textContent).toContain('What are you training for?')
    expect(mocks.nav).not.toHaveBeenCalledWith('/coach', { replace: true })
  })

  it('goes from the consent to the chat when the club does not let the Coach write plans', async () => {
    BOOT.coach = { can: { writePrograms: false } }
    await render()
    await agree()
    expect(mocks.nav).toHaveBeenCalledWith('/coach', { replace: true })
    expect(container.textContent).not.toContain('What are you training for?')
    expect(mocks.S.coach.consent).toBeTruthy()
  })

  it('says the club writes the plan, and asks nothing more, when it does', async () => {
    BOOT.coach = { can: { writePrograms: true, changePlan: false } }
    await render()
    expect(container.textContent).toContain('Your club writes your plan, so the Coach does not change it.')
    expect(container.textContent).not.toContain('It designs your plan')
    await agree()
    expect(mocks.nav).toHaveBeenCalledWith('/coach', { replace: true })
    expect(container.textContent).not.toContain('What are you training for?')
  })
})
