// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// THE CONTRACT OF THE SIMPLE LEVEL, as an executable list.
////
//// Why a rendering test and not a unit test on levelOf(): the unit test
//// (store/level.test.js) pins the RESOLUTION; this one pins WHAT DISAPPEARS.
//// The two fail for different reasons, and the second is the one that catches
//// an upstream merge quietly putting a technical card back on the beginner's
//// screen — which is precisely how this feature dies without anyone noticing.
////
//// Reading it also answers "what does Simple actually hide?" without opening
//// Stats.jsx.

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Stats from './Stats.jsx'

const mocks = vi.hoisted(() => ({ simple: false, S: {} }))

vi.mock('../store/useStore.js', () => ({
  useStore: selector => selector({ S: mocks.S }),
  isSimple: () => mocks.simple,
  atLeast: (_S, lvl) => (mocks.simple ? lvl === 'simple' : true),
  levelOf: () => (mocks.simple ? 'simple' : 'full'),
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../sheets.jsx', () => ({
  bwSheet: () => {}, goalSheet: () => {}, calendarSheet: () => {}, workoutDetailSheet: () => {},
  WorkoutRow: () => React.createElement('div'), bwDeltaColor: () => 'inherit',
}))

const workout = (d, id) => ({
  d, t: new Date(d).getTime(),
  entries: [{ id, sets: [{ w: 60, r: 5, done: true, rir: 1 }, { w: 60, r: 5, done: true, rir: 0 }] }],
})

const baseState = () => ({
  unit: 'kg', body: 'male', effort: 'rir', targetW: null,
  bodyweight: [{ d: '2026-08-01', w: 70 }, { d: '2026-08-20', w: 69 }],
  routines: [], customEx: [],
  workouts: [workout('2026-08-20', 'bench-press'), workout('2026-08-22', 'bench-press')],
})

let dom, root, container

const mount = () => {
  act(() => { root.render(React.createElement(Stats)) })
  return container.textContent
}

beforeEach(() => {
  dom = new Window({ url: 'https://localhost' })
  global.window = dom.window ?? dom
  global.document = global.window.document
  global.navigator = global.window.navigator
  container = global.document.createElement('div')
  global.document.body.appendChild(container)
  root = createRoot(container)
  mocks.simple = false
  mocks.S = baseState()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('Stats — level of detail', () => {
  it('shows the technical cards at the full level', () => {
    const text = mount()
    // The body map (fatigue / retained strength / muscle balance) and the
    // effort histogram: the two the client named as off-putting.
    expect(text).toContain('Muscle balance')
    expect(text).toContain('Fatigue')
    expect(text).toContain('Effort')
  })

  it('hides them at the simple level', () => {
    mocks.simple = true
    const text = mount()
    expect(text).not.toContain('Muscle balance')
    expect(text).not.toContain('Fatigue')
    expect(text).not.toContain('Est. 1RM')
  })

  it('keeps what a beginner can read — nothing is emptied', () => {
    mocks.simple = true
    const text = mount()
    // Everything below stays: the point is DENSITY, not removing the journal.
    expect(text).toContain('Workouts')          // how many sessions
    expect(text).toContain('Body weight')       // the weight curve
    expect(text).toContain('Exercise progress') // the top-set curve
  })

  it('drops the metric selector once only one curve is left', () => {
    // Verified on screen and pinned here: with 'Est. 1RM' and 'Effort' gone,
    // the segment has a single option and hides itself rather than showing a
    // control with nothing to choose. The curve itself stays.
    mocks.simple = true
    const text = mount()
    expect(text).toContain('Exercise progress')
    expect(text).not.toContain('Top set')   // the segment is gone, not the graph
    expect(text).not.toContain('Effort')
  })

  it('brings every card back when the level goes up again', () => {
    mocks.simple = true
    mount()
    act(() => root.unmount())
    root = createRoot(container)
    mocks.simple = false
    const text = mount()
    expect(text).toContain('Muscle balance')
    expect(text).toContain('Effort')
  })
})
