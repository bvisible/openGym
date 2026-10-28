// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// What changed on Home (12.10): the plan's set-up card took the middle of the screen for what it is worth, and the
//// last sessions, with a button to share them, were two screens away. So: « Recent workouts » (the last three, each with a visible Share
//// button), and the plan's set-up as ONE compact row — below the recent workouts when there are some.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import Home from './Home.jsx'

const nav = vi.fn()
const detail = vi.fn()
const share = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '', weighInsSheet: vi.fn(),
  // the row is sheets.jsx's own and is tested there; here it only has to be handed the right things
  WorkoutRow: ({ w, onClick, onShare }) => <div className="item wrow" data-id={w.id}>
    <button className="open" onClick={onClick}>{w.name}</button>
    {onShare && <button className="share" onClick={() => onShare(w)}>Share</button>}
  </div>,
  workoutDetailSheet: (...a) => detail(...a), shareWorkoutImageSheet: (...a) => share(...a),
}))

const routines = [{ id: 'r1', name: 'Push', emoji: null, ex: [{ id: '0025' }] }]
const wk = (id, d) => ({ id, d, name: 'Workout ' + id, start: 1, end: 2, entries: [] })

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  nav.mockClear(); detail.mockClear(); share.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const setS = (over = {}) => useStore.setState(s => ({
  S: { ...s.S, routines: [], dayPlan: {}, week: {}, workouts: [], active: null, weighIn: false, queue: null, rotation: null, scheduleMode: null, ...over },
  user: null,
}))
const mount = () => act(() => root.render(<Home />))
const section = () => host.querySelector('.recent-workouts')
const rows = () => [...host.querySelectorAll('.recent-workouts .wrow')]
const order = sel => [...host.querySelectorAll(sel)].map(e => e.compareDocumentPosition ? e : e)
const before = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('Home — recent workouts', () => {
  it('draws nothing until a first workout is logged', () => {
    setS({ routines })
    mount()
    expect(section()).toBeNull()
  })

  it('lists the last three, newest first, under the title the Stats screen already uses', () => {
    setS({ routines, workouts: [wk('a', '2026-09-01'), wk('b', '2026-09-05'), wk('c', '2026-09-03'), wk('d', '2026-09-09')] })
    mount()
    expect(section().querySelector('h4').textContent).toBe('Recent workouts')
    expect(rows().map(r => r.dataset.id)).toEqual(['d', 'b', 'c'])
    expect(section().textContent).toContain('All 4')
  })

  it('a tap on a row opens the workout\'s detail; its Share button opens the share sheet and nothing else', () => {
    setS({ routines, workouts: [wk('a', '2026-09-01'), wk('b', '2026-09-05')] })
    mount()
    act(() => { rows()[0].querySelector('.open').click() })
    expect(detail).toHaveBeenCalledTimes(1)
    expect(detail.mock.calls[0][0].id).toBe('b')
    act(() => { rows()[1].querySelector('.share').click() })
    expect(share).toHaveBeenCalledTimes(1)
    expect(share.mock.calls[0][0].id).toBe('a')
    expect(detail).toHaveBeenCalledTimes(1)
  })

  it('every row carries a visible Share button, and « All » goes to the history', () => {
    setS({ routines, workouts: [wk('a', '2026-09-01'), wk('b', '2026-09-05'), wk('c', '2026-09-07')] })
    mount()
    expect(rows().every(r => r.querySelector('.share'))).toBe(true)
    act(() => { [...section().querySelectorAll('button')].find(b => b.textContent.startsWith('All')).click() })
    expect(nav).toHaveBeenCalledWith('/history')
  })

  it('sits after the week and today card, whether or not there is a plan', () => {
    setS({ routines, week: { 0: ['r1'], 1: ['r1'], 2: ['r1'], 3: ['r1'], 4: ['r1'], 5: ['r1'], 6: ['r1'] }, workouts: [wk('a', '2026-09-01')] })
    mount()
    expect(before(host.querySelector('.today-row'), section())).toBe(true)
  })
})

describe('Home — the plan\'s set-up as one compact row', () => {
  const compact = () => host.querySelector('.plan-compact')

  it('an account with no routine gets one compact row: a title and two small buttons, in place of the big Welcome card', () => {
    setS()
    mount()
    expect(compact()).toBeTruthy()
    expect(compact().querySelector('.plan-compact-title').textContent).toBe('Welcome!')
    const buttons = [...compact().querySelectorAll('button')]
    expect(buttons.map(b => b.textContent)).toEqual(['Load starter plan', 'Build my own plan'])
    expect(buttons.every(b => b.classList.contains('sm'))).toBe(true)
    expect(host.textContent).not.toContain('Set up your weekly routine to get going')
    expect(host.querySelectorAll('.card .big').length).toBe(0)
  })

  it('« Build my own plan » goes to the plan', () => {
    setS()
    mount()
    act(() => { [...compact().querySelectorAll('button')].find(b => b.textContent === 'Build my own plan').click() })
    expect(nav).toHaveBeenCalledWith('/plan')
  })

  it('below the recent workouts when there are some', () => {
    setS({ workouts: [wk('a', '2026-09-01')] })
    mount()
    expect(compact()).toBeTruthy()
    expect(before(section(), compact())).toBe(true)
  })

  it('an account that has routines, or a session running, has no such row', () => {
    setS({ routines })
    mount()
    expect(compact()).toBeNull()
    act(() => root.unmount()); root = createRoot(host)
    setS({ active: { id: 'a', name: 'Push', start: Date.now(), cur: 0, entries: [] } })
    mount()
    expect(compact()).toBeNull()
  })

  it('Rotation chosen with nothing built: the home screen says nothing about it (the Plan screen keeps its own empty state)', () => {
    // The club's coach, 28.10: « No rotation yet, set up the plan » was the first thing shown on opening the app, and means nothing to most members.
    setS({ routines, scheduleMode: 'rotation' })
    mount()
    expect(host.textContent).not.toContain('No rotation yet')
    expect(host.textContent).not.toContain('Set up in Plan')
    expect(host.querySelector('.today-row')).toBeTruthy()    // the Today row still starts the next session
    act(() => root.unmount()); root = createRoot(host)
    setS({ scheduleMode: 'rotation' })    // no routine at all: the compact row speaks for it
    mount()
    expect(host.textContent).not.toContain('No rotation yet')
    expect(compact()).toBeTruthy()
  })
})
