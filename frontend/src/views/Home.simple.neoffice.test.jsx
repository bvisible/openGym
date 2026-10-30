// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// The home screen at each detail level (30.10, « de gros bébé »): at Simple only what a person needs on arrival (the club's notices,
//// the badges, a coach's offer, today's session, the check-in codes, and the weight: Jérémy's 01.09 rule, see bodyweight.reachable.test.jsx);
//// the floor plan, the recent workouts and the streak come back at Normal.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import Home from './Home.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(), floorPlanSheet: vi.fn(), coachOfferSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '', weighInsSheet: vi.fn(),
  WorkoutRow: () => null, workoutDetailSheet: vi.fn(), shareWorkoutImageSheet: vi.fn(),
}))

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const mountAt = (level, extra = {}) => {
  useStore.setState(s => ({
    S: {
      ...s.S, routines: [], workouts: [{ id: 'w1', d: '2026-10-20', name: 'Push', start: 1, end: 3600001, entries: [] }], bodyweight: [], dayPlan: {}, week: {}, active: null,
      level, perms: {}, showWeightCard: true, ...extra,
    },
    user: null,
  }))
  act(() => root.render(<Home />))
}
const heading = text => [...host.querySelectorAll('h2, .lbl2')].find(el => el.textContent === text)
const text = () => host.textContent

describe('Home by detail level', () => {
  it('Simple: no streak, no recent workouts', () => {
    mountAt('simple')
    expect(text()).not.toMatch(/week streak/i)
    expect(text()).not.toContain('Recent workouts')
  })

  it('Simple keeps the check-in card', () => {
    mountAt('simple')
    expect(text()).toContain('Check in')
  })

  it('Simple keeps the weight card (« relégué, PAS planqué », 01.09), and its switch in Settings still turns it off', () => {
    mountAt('simple')
    expect(heading('Body weight')).toBeTruthy()
    mountAt('simple', { showWeightCard: false })
    expect(heading('Body weight')).toBeFalsy()
  })

  it.each(['normal', 'full'])('%s: the streak and the recent workouts are there', level => {
    mountAt(level)
    expect(text()).toMatch(/week streak/i)
  })
})
