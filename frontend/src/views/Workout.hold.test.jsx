// @vitest-environment happy-dom
// The end of a hold, against the real store and work timer: it sounds once. The chime and its
// buzz pattern belong to the timer (store/useUI.js); the set it ticks adds neither its own beep,
// which clipped the chime's first note, nor its short buzz, which cut the pattern off.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { beep, chime, vibrate } from '../lib/sound.js'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), unlock: vi.fn() }))
vi.mock('../lib/api.js', () => ({
  //// Neoffice — BOOT: the page's boot data (lib/api.js), read by our screens at import.
  BOOT: {}, api: vi.fn(() => Promise.resolve({})), appBase: () => '/' }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
const plank = () => ({ id: '1001', target: { mode: 'time', sets: 2, sec: 10 }, sets: [{ sec: 10, w: 0, done: false }, { sec: 10, w: 0, done: false }] })

let root
let container

function renderWorkout(entries) {
  const S = clone(DEF)
  S.sound = true
  S.active = { id: 'hold-test', d: '2026-09-23', start: Date.now(), routineId: null, name: 'Hold', bw: null, cur: 0, entries }
  useStore.setState({ S, user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
}

const startHold = () => {
  const go = container.querySelector('button[aria-label="Start set"]')
  expect(go).toBeTruthy()
  act(() => go.click())
  //// Neoffice — through our 3-2-1 (useUI.startWorkWithPrep): the hold starts once the count is
  //// through, and the count's own beeps and buzzes (its "go" is a 1040 Hz note) are not the hold's.
  act(() => { vi.advanceTimersByTime(3_000) })
  vi.mocked(beep).mockClear(); vi.mocked(vibrate).mockClear()
  expect(useUI.getState().work).not.toBeNull()
}
const tickBeeps = () => beep.mock.calls.filter(call => call[1] === 1040)
const doneOf = () => useStore.getState().S.active.entries[0].sets.map(s => s.done)

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  vi.mocked(beep).mockClear(); vi.mocked(chime).mockClear(); vi.mocked(vibrate).mockClear()
  useUI.setState({ sheets: [], toastMsg: '', timer: null, work: null })
  root = null
  container = null
})

afterEach(() => {
  if (root) act(() => root.unmount())
  if (container) container.remove()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  useUI.getState().cancelPrep()   //// Neoffice — a count left running would start the next test's hold
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('the end of a hold', () => {
  it('ran out on its own: the chime and its buzz pattern, and no tick beep or short buzz after them', () => {
    renderWorkout([plank()])
    startHold()
    act(() => { vi.advanceTimersByTime(11_000) })
    expect(doneOf()).toEqual([true, false])
    expect(chime).toHaveBeenCalledOnce()
    expect(tickBeeps()).toEqual([])
    expect(vibrate.mock.calls).toEqual([[[200, 100, 200]]])
  })

  it('finished early with Done: the set ticks the way a tap does, beep and buzz', () => {
    renderWorkout([plank()])
    startHold()
    act(() => { vi.advanceTimersByTime(4_000) })
    act(() => useUI.getState().finishWorkEarly())
    expect(doneOf()).toEqual([true, false])
    expect(chime).not.toHaveBeenCalled()
    expect(tickBeeps()).toHaveLength(1)
    expect(vibrate).toHaveBeenLastCalledWith(30)
  })
})
