// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent). The calmed home screen (views/HomeToday.jsx): today's session as the one task, and only what a member needs
//// on arrival under it. What moved elsewhere (floor plan, recent workouts, weight curve) must not be here, and what must stay (the weight, « relégué, PAS planqué »)
//// must be there at every level.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HomeToday from './HomeToday.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'
import { NOTICES_SEEN_KEY } from '../lib/use-home-feed.js'
import { startFlow, bwSheet, coachOfferSheet, starterPlanSheet } from '../sheets.jsx'

const m = vi.hoisted(() => ({ nav: vi.fn(), doors: { nora: false, human: false, any: false }, offers: [], notices: [], challenges: [] }))
vi.mock('react-router-dom', () => ({ useNavigate: () => m.nav }))
vi.mock('../lib/use-coach-doors.js', () => ({ useCoachDoors: () => m.doors }))
vi.mock('../lib/api.js', async importOriginal => ({
  ...await importOriginal(),
  programInbox: vi.fn(() => Promise.resolve(m.offers)),
  announcements: vi.fn(() => Promise.resolve({ announcements: m.notices })),
  myBadges: vi.fn(() => Promise.resolve({ enabled: false })),
  challengesMine: vi.fn(() => Promise.resolve({ challenges: m.challenges })),
}))
vi.mock('../sheets.jsx', () => ({
  startFlow: vi.fn(), bwSheet: vi.fn(), bwDeltaColor: () => '', coachOfferSheet: vi.fn(), calendarSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  starterPlanSheet: vi.fn(), weighInsSheet: vi.fn(), floorPlanSheet: vi.fn(),
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root, originalS, originalUser
const push = { id: 'r1', name: 'Upper body', emoji: null, ex: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] }

beforeEach(() => {
  const st = useStore.getState()
  originalS = st.S; originalUser = st.user
  vi.clearAllMocks()
  m.doors = { nora: false, human: false, any: false }
  m.offers = []; m.notices = []; m.challenges = []
  localStorage.removeItem(NOTICES_SEEN_KEY)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useStore.setState({ S: originalS, user: originalUser })
})

const mount = async (over = {}) => {
  useStore.setState({
    S: { ...JSON.parse(JSON.stringify(DEF)), routines: [push], week: { [new Date().getDay()]: ['r1'] }, dayPlan: {}, workouts: [], bodyweight: [], active: null, queue: null,
      rotation: null, scheduleMode: null, perms: {}, showWeightCard: true, classesTab: true, ...over },
    user: { id: 1, name: 'Alex' },
  })
  await act(async () => { root.render(<HomeToday />) })
}
const button = label => [...host.querySelectorAll('button')].find(b => b.textContent.includes(label))
const text = () => host.textContent

describe('today as the one task', () => {
  it('greets the member, names today’s session and starts it with one filled button', async () => {
    await mount()
    expect(host.querySelector('h1').textContent).toBe('Hi Alex')
    expect(host.querySelector('.home-hero-title').textContent).toBe('Upper body')
    expect(text()).toContain('4 exercises')
    const go = host.querySelector('.home-hero-go')
    expect(go.textContent).toBe('Start workout')
    expect(go.className).toContain('primary')
    await act(async () => { go.click() })
    expect(startFlow).toHaveBeenCalledWith(['r1'])
  })

  it('draws the seven days of the week inside the hero, today among them', async () => {
    await mount()
    expect(host.querySelectorAll('.home-hero .week .wday')).toHaveLength(7)
    expect(host.querySelectorAll('.home-hero .week .wday.today')).toHaveLength(1)
  })

  it('says it is a rest day, and offers another workout rather than a Start', async () => {
    await mount({ week: { [(new Date().getDay() + 2) % 7]: ['r1'] } })
    expect(host.querySelector('.home-hero-title').textContent).toBe('Rest day')
    expect(host.querySelector('.home-hero-go').textContent).toContain('Choose a different workout')
    await act(async () => { host.querySelector('.home-hero-go').click() })
    expect(m.nav).toHaveBeenCalledWith('/workout')
    expect(startFlow).not.toHaveBeenCalled()
  })

  it('welcomes a member with no routine and offers the starter plan', async () => {
    await mount({ routines: [], week: {} })
    expect(host.querySelector('.home-hero-title').textContent).toBe('Welcome!')
    await act(async () => { button('Load starter plan').click() })
    expect(starterPlanSheet).toHaveBeenCalled()
  })

  it('resumes a running session instead of starting another', async () => {
    await mount({ active: { id: 'x', name: 'Upper body', start: Date.now() - 60000, entries: [] } })
    expect(host.querySelector('.home-hero-title').textContent).toBe('Upper body (in progress)')
    await act(async () => { host.querySelector('.home-hero-go').click() })
    expect(m.nav).toHaveBeenCalledWith('/workout')
    expect(startFlow).not.toHaveBeenCalled()
  })

  it('says a session is done once logged, with no Start', async () => {
    await mount({ workouts: [{ id: 'w1', d: todayISO(), name: 'Upper body', routineIds: ['r1'], routineId: 'r1', start: 1, end: 2, entries: [] }] })
    expect(host.querySelector('.home-hero-title').textContent).toBe('Upper body (done)')
    expect(button('Start workout')).toBeUndefined()
  })
})

describe('the access code', () => {
  it('is a button in the header that opens the check-in', async () => {
    await mount()
    await act(async () => { button('My access').click() })
    expect(m.nav).toHaveBeenCalledWith('/checkin')
  })
  it('is gone when the member switched the check-in off', async () => {
    await mount({ checkIn: false })
    expect(button('My access')).toBeUndefined()
  })
})

describe('what is waiting to be read', () => {
  it('shows nothing when nothing is waiting', async () => {
    await mount()
    expect(host.querySelector('.home-read')).toBeNull()
  })

  it('puts the coach’s program before a notice, and opens the offer on a tap', async () => {
    m.offers = [{ id: 'o1', coach: 'Coach D', bundle: {} }]
    m.notices = [{ name: 'n1', title: 'New squat rack', body: 'At the back of the room.', modified: '2026-10-29' }]
    await mount()
    const rows = [...host.querySelectorAll('.home-read-row')]
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('Coach D sent you a program')
    expect(rows[1].textContent).toContain('New squat rack')
    await act(async () => { rows[0].click() })
    expect(coachOfferSheet).toHaveBeenCalledWith(m.offers[0])
  })

  it('remembers a notice the member closed, on their device, until the club corrects it', async () => {
    m.notices = [{ name: 'n1', title: 'New squat rack', body: 'At the back of the room.', modified: '2026-10-29' }]
    await mount()
    await act(async () => { host.querySelector('.home-read-row [aria-label="Close"]').click() })
    expect(host.querySelector('.home-read')).toBeNull()
    expect(JSON.parse(localStorage.getItem(NOTICES_SEEN_KEY))).toEqual({ n1: '2026-10-29' })
    // a new version of the same notice reopens
    act(() => root.unmount())
    root = createRoot(host)
    m.notices = [{ name: 'n1', title: 'New squat rack', body: 'Moved to the left.', modified: '2026-10-30' }]
    await act(async () => { root.render(<HomeToday />) })
    expect(host.querySelector('.home-read-row').textContent).toContain('Moved to the left.')
  })
})

describe('the way to the coach', () => {
  it('has no coach card for a club without a coach or Nora', async () => {
    await mount()
    expect(host.querySelector('.home-coach')).toBeNull()
  })
  it('offers each door that exists', async () => {
    m.doors = { nora: true, human: true, any: true }
    await mount()
    await act(async () => { button('Write to your coach').click() })
    expect(m.nav).toHaveBeenCalledWith('/coach-thread')
    await act(async () => { button('Ask Nora').click() })
    expect(m.nav).toHaveBeenCalledWith('/coach')
  })
  it('offers only Nora when she is the only one', async () => {
    m.doors = { nora: true, human: false, any: true }
    await mount()
    expect(button('Write to your coach')).toBeUndefined()
    expect(button('Ask Nora')).toBeTruthy()
  })
})

// BODY WEIGHT IS DEMOTED, NOT HIDDEN: views/bodyweight.reachable.test.jsx holds the upstream-shaped screen to it, this holds the calmed one.
describe('the weight', () => {
  it.each(['simple', 'normal', 'full'])('is on the home screen at the %s level, one tap from being logged', async level => {
    await mount({ level, weighInEvery: 'never' })
    expect(host.querySelector('.home-weight')).toBeTruthy()
    await act(async () => { button('Log').click() })
    expect(bwSheet).toHaveBeenCalled()
  })

  it('shows the last weigh-in with how it moved', async () => {
    await mount({ unit: 'kg', bodyweight: [{ d: '2026-10-01', w: 74, t: 1 }, { d: '2026-10-20', w: 73, t: 2 }] })
    expect(host.querySelector('.home-weight').textContent).toContain('73 kg')
  })

  it('goes when the member took the card out', async () => {
    await mount({ showWeightCard: false })
    expect(host.querySelector('.home-weight')).toBeNull()
  })
})

describe('what moved elsewhere is not here', () => {
  it('has neither the floor plan, nor the recent workouts, nor a weight chart', async () => {
    await mount({ workouts: [{ id: 'w1', d: '2026-10-20', name: 'Push', start: 1, end: 3600001, entries: [] }], bodyweight: [{ d: '2026-10-01', w: 74, t: 1 }, { d: '2026-10-20', w: 73, t: 2 }] })
    expect(text()).not.toContain('Floor plan')
    expect(text()).not.toContain('Recent workouts')
    expect(host.querySelector('.chart')).toBeNull()
  })

  it('keeps the club’s challenges here only when the classes are not in the bar (their place is Planning)', async () => {
    m.challenges = [{ name: 'c1', title: 'October push', running: true, joined: false }]
    await mount({ perms: { classes: false } })
    expect(text()).toContain('October push')
    act(() => root.unmount()); root = createRoot(host)
    await mount()
    expect(text()).not.toContain('October push')
  })
})
