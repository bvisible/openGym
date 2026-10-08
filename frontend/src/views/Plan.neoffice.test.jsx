// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent). What the Neoffice journal changes on upstream's Plan
//// (v1.3.10, two views): it opens on the routines (#765), a club that writes its members' plans locks
//// every way of changing one and says why, the member sees where they stand in their coach's cycle, and
//// a routine a coach sent names its program.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Plan from './Plan.jsx'
import { dayAssignSheet, menuSheet } from '../sheets.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null, nav: null, coach: false }
  state.snapshot = () => ({
    S: state.S,
    user: null,
    update: mut => {
      const next = structuredClone(state.S)
      mut(next)
      state.S = next
    },
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => (selector ? selector(mocks.snapshot()) : mocks.snapshot())
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { reminder: { time: '17:30' } }, hasData: () => false }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.nav }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false, isAndroid: () => Promise.resolve(false), shareExport: vi.fn(), syncReminder: vi.fn() }))
vi.mock('../lib/coach.js', () => ({ coachAvailable: () => mocks.coach }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), dayAssignSheet: vi.fn(), menuSheet: vi.fn(), confirmSheet: vi.fn(),
  planHasRoutines: s => (s.routines || []).some(r => r.ex.length), exportPlanFile: vi.fn(), printWholePlan: vi.fn(), importPlanFile: vi.fn(),
}))

let host, root
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.removeItem('gym_plan_view')
  mocks.nav = vi.fn()
  mocks.coach = false
  mocks.S = {
    unit: 'kg', workouts: [], exWeights: {}, week: { 1: ['r1'] }, dayPlan: {},
    routines: [
      { id: 'r1', name: 'Push', emoji: null, ex: [{ id: 'a' }] },
      { id: 'r2', name: 'Full body', emoji: null, ex: [{ id: 'b' }], coachProgram: 'PROG-1', coachProgramName: 'Strength block' },
    ],
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  localStorage.removeItem('gym_plan_view')
})

const mount = () => act(() => root.render(<Plan />))
const buttons = () => [...host.querySelectorAll('button')].map(b => b.textContent)
const seg = label => [...host.querySelectorAll('.plan-views button')].find(b => b.textContent === label)

describe('Plan on Neoffice', () => {
  it('opens on the routines when the member never chose a view (#765)', () => {
    mount()
    expect(host.querySelector('.plan-routines')).toBeTruthy()
    expect(host.querySelector('.plan-mode')).toBe(null)
    act(() => seg('Schedule').click())
    expect(host.querySelector('.plan-mode')).toBeTruthy()
    expect(localStorage.getItem('gym_plan_view')).toBe('schedule')
  })

  it('a routine a coach sent says which program it came from', () => {
    mount()
    const subs = [...host.querySelectorAll('.plan-routine .ss')].map(e => e.textContent)
    expect(subs[1]).toContain('Strength block')
    expect(subs[0]).not.toContain('Strength block')
  })

  it('where the club writes the plan, nothing changes it and the screen says why', () => {
    mocks.S.perms = { editPlan: false }
    mount()
    expect(host.textContent).toContain('Your coach writes your plan.')
    expect(buttons()).not.toContain('New routine')
    expect(buttons()).not.toContain('Edit')
    // A routine still opens, to be read.
    act(() => host.querySelector('.plan-routine').click())
    expect(mocks.nav).toHaveBeenCalledWith('/plan/r/r1')
    act(() => seg('Schedule').click())
    act(() => host.querySelector('.plan-day[aria-label="Monday"]').click())
    expect(dayAssignSheet).not.toHaveBeenCalled()
    expect(host.querySelector('.plan-mode .seg-inline')).toBe(null)
    act(() => host.querySelector('[aria-label="Plan options"]').click())
    const labels = menuSheet.mock.calls[0][0].items.filter(Boolean).map(i => i.label)
    expect(labels).not.toContain('Import a plan file')
    expect(labels).not.toContain('Load starter plan')
    expect(labels).toContain('Export plan file')
  })

  it('behind the club’s lock, the Coach is not offered as designing the plan', () => {
    //: Seen in Chrome on 08.10: the Plan menu promised « Conception de plans et bilans » to a
    //: member whose plan the club writes. The Coach's server refuses those jobs for them now.
    mocks.coach = true
    const coachItem = () => {
      act(() => host.querySelector('[aria-label="Plan options"]').click())
      return menuSheet.mock.calls.at(-1)[0].items.filter(Boolean).find(i => i.label === 'Coach')
    }
    mount()
    expect(coachItem().sub).toBe('Plan design and reviews, from your own training')
    mocks.S.perms = { editPlan: false }
    mount()
    expect(coachItem().sub).toBe('Your club writes your plan, so the Coach does not change it.')
  })

  it('a member who may change their plan keeps every control', () => {
    mount()
    expect(host.textContent).not.toContain('Your coach writes your plan.')
    expect(buttons()).toContain('New routine')
    act(() => seg('Schedule').click())
    act(() => host.querySelector('.plan-day[aria-label="Monday"]').click())
    expect(dayAssignSheet).toHaveBeenCalledWith(1)
  })

  it('shows where the member stands in their coach’s cycle', () => {
    mocks.S.coachCycle = { span: 4, name: 'Strength block', appliedWeek: 2, startedOn: '2026-10-05' }
    mount()
    expect(host.querySelector('.cyclebar')).toBeTruthy()
    expect(host.querySelectorAll('.cyclebar i').length).toBe(4)
  })
})
