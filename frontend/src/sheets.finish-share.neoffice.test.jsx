// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// « Finish and share ». The pilot club (23.10): a member's pride is at its highest the moment the session ends, and every shared
//// picture is free publicity for the club — so the sheets that end a workout offer to share it, and the summary that follows
//// does too. The share sheet opens over the summary (sheets stack): closing it shows the summary again.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { finishWorkout, finishWorkoutSheet, workoutCompleteSheet } from './sheets.jsx'
import { EXDB } from './lib/exercises-data.js'

// The share sheet draws on a canvas: what is tested here is that it OPENS, on the saved workout.
vi.mock('./components/ShareSheet.jsx', () => ({ default: ({ w }) => <div data-share-stub={w.id}>share sheet</div> }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const mounted = []

const hostOf = sheet => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const top = () => hostOf(useUI.getState().sheets.at(-1))
const tap = (host, text) => {
  const target = [...host.querySelectorAll('button, .menu-item')].find(b => b.textContent.trim() === text)
  expect(target, text).toBeTruthy()
  act(() => { target.click() })
}
const isShare = host => !!host.querySelector('[data-share-stub]')
const isSummary = host => host.textContent.includes('Workout complete!')

function install(sets) {
  const st = clone(DEF)
  st.active = {
    id: 'fin', d: '2026-10-23', start: Date.now() - 20 * 60000, routineId: null, name: 'Push', bw: null, cur: 0,
    entries: [{ id: EXDB[0].id, target: { mode: 'reps', sets: sets.length, reps: 5, weight: 40 }, sets }],
  }
  useStore.setState({ S: st, user: null })
}

beforeEach(() => {
  localStorage.clear()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  useUI.setState({ sheets: [], timer: null, work: null })
})
afterEach(() => {
  mounted.splice(0).forEach(r => act(() => r.unmount()))
  document.body.innerHTML = ''
})

describe('Finish and share', () => {
  it('the Finish sheet saves, then opens the share sheet on the saved workout, over the summary', () => {
    install([{ w: 40, r: 5, done: true }])
    act(() => finishWorkoutSheet({ onDiscard: vi.fn() }))
    tap(top(), 'Finish and share')

    expect(S().active).toBeNull()
    expect(S().workouts).toHaveLength(1)
    const sheets = useUI.getState().sheets
    expect(sheets).toHaveLength(2)                       // the menu closed itself on the tap: the summary, then the share sheet
    const share = top()
    expect(isShare(share)).toBe(true)
    expect(share.querySelector('[data-share-stub]').getAttribute('data-share-stub')).toBe(String(S().workouts[0].id))
    expect(isSummary(hostOf(sheets.at(-2)))).toBe(true)  // the summary waits right under it
  })

  it('Finish and save still opens the summary alone', () => {
    install([{ w: 40, r: 5, done: true }])
    act(() => finishWorkoutSheet({ onDiscard: vi.fn() }))
    tap(top(), 'Finish and save')

    expect(S().workouts).toHaveLength(1)
    expect(isSummary(top())).toBe(true)
    expect(useUI.getState().sheets.some(sh => isShare(hostOf(sh)))).toBe(false)
  })

  it('the « whole workout » sheet offers it too, between Finish workout and Continue workout', () => {
    install([{ w: 40, r: 5, done: true }])
    act(() => workoutCompleteSheet())
    const host = top()
    expect([...host.querySelectorAll('button')].map(b => b.textContent.trim())).toEqual(['Finish workout', 'Finish and share', 'Continue workout'])
    tap(host, 'Finish and share')

    expect(S().workouts).toHaveLength(1)
    expect(isShare(top())).toBe(true)
  })

  it('an early finish asks its question first, and the share follows the confirmation', () => {
    install([{ w: 40, r: 5, done: true }, { w: 40, r: 5 }])
    act(() => finishWorkout({ share: true }))
    expect(S().active).not.toBeNull()                    // nothing saved before the member says yes
    tap(top(), 'Finish workout')

    expect(S().active).toBeNull()
    expect(S().workouts).toHaveLength(1)
    expect(isShare(top())).toBe(true)
  })

  it('a button handing its click event to finishWorkout does not share', () => {
    install([{ w: 40, r: 5, done: true }])
    act(() => finishWorkout({ type: 'click', share: undefined }))

    expect(S().workouts).toHaveLength(1)
    expect(useUI.getState().sheets.some(sh => isShare(hostOf(sh)))).toBe(false)
  })

  it('the summary has its own Share button, which opens the share sheet over it', () => {
    install([{ w: 40, r: 5, done: true }])
    act(() => finishWorkout())
    const summary = top()
    expect(isSummary(summary)).toBe(true)
    tap(summary, 'Share')

    expect(isShare(top())).toBe(true)
    expect(useUI.getState().sheets).toHaveLength(2)
  })
})
