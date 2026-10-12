// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// THE LIVE SESSION SCREEN AT EACH DETAIL LEVEL.
////
//// Written after a leak found on osiris on 31.08, and the leak is the lesson:
//// lib/level-visibility.test.js was green, every rule in it correct — and the
//// workout screen showed "+ Drop", "+ Burst" and "Add warm-up set" to a member
//// on Normal whose exercises carried none of them. The rules were right; the
//// screen simply never called them. A unit test on a rule proves the rule, not
//// that anybody applies it.
////
//// So this one mounts the real screen against the REAL store — no mocked
//// useStore. A store mock here would have to model three levels itself, and a
//// mock that models the thing it is testing is how you get seven green tests
//// over a bug (this repo already paid for that once, with a floor-plan mock
//// that reproduced an API wrapper that never existed).

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import Workout from './Workout.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))

const mounted = []

//// One exercise, three plain sets, nothing technical on it: no drops, no
//// clusters, no warm-up rows. That is the state in which the leak showed —
//// and the only state in which the "already in use" exception cannot be what
//// keeps the controls on screen.
const plainSession = () => ({
  id: 'w1', d: '2026-08-31', start: Date.now(), routineId: null, name: 'Bas du corps',
  bw: null, cur: 0,
  entries: [{
    id: 'squat', target: {}, plan: null,
    sets: [
      { w: 60, r: 8, done: false },
      { w: 60, r: 8, done: false },
      { w: 60, r: 8, done: false },
    ],
  }],
})

const at = (level, session = plainSession()) => {
  //// Upstream v1.3.5 hides the chips and the warm-up/remove/add row behind a
  //// switch (Settings → Workout controls, off by default). Switched ON here: what
  //// this file pins is the LEVEL gate on top of it — a beginner with the switch on
  //// still gets no technique offered.
  useStore.setState(s => ({ S: { ...s.S, level, unit: 'kg', active: session, wc: { setShortcuts: true } } }))
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(React.createElement(Workout)))
  return host.textContent
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [] })
  document.body.innerHTML = ''
})

afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  useStore.setState(s => ({ S: { ...s.S, active: null, level: null } }))
})

describe('the workout screen at each detail level', () => {
  it('shows the intensity techniques at the full level', () => {
    const text = at('full')
    expect(text).toContain('+ Drop')
    expect(text).toContain('+ Burst')
    expect(text).toContain('Add warm-up set')
  })

  it('hides them at normal — the leak that shipped', () => {
    const text = at('normal')
    expect(text).not.toContain('+ Drop')
    expect(text).not.toContain('+ Burst')
    expect(text).not.toContain('Add warm-up set')
  })

  it('hides them at simple', () => {
    const text = at('simple')
    expect(text).not.toContain('+ Drop')
    expect(text).not.toContain('+ Burst')
    expect(text).not.toContain('Add warm-up set')
  })

  it('leaves the ordinary set controls alone at every level', () => {
    // The point of the level is DENSITY, not capability. Adding and removing a
    // set is how you log a workout; it is not a technique, and taking it away
    // would stop being a simplification and start being a smaller product.
    for (const level of ['simple', 'normal', 'full']) {
      const text = at(level)
      expect(text, level).toContain('Add set')
      expect(text, level).toContain('Remove set')
    }
  })

  it('keeps the chips on a set that already carries drops', () => {
    // The exception, at the moment it matters most: mid-set. A member must
    // never be left with drops they cannot match.
    const session = plainSession()
    session.entries[0].sets[0] = {
      w: 60, r: 8, done: false, type: 'dropset',
      drops: [{ w: 50, r: 6 }],
    }
    const text = at('simple', session)
    expect(text).toContain('+ Drop')
  })
})

//// Neoffice — the exercise menu of the live session (the « ⋯ » of an exercise) at each level: plate loading comes from Normal up, and at
//// Simple the line under « Exercise settings » no longer names progression, since the sheet it opens no longer holds it (12.10).
describe('the exercise menu at each detail level', () => {
  const menuOf = (level, extra = {}) => {
    at(level, plainSession())
    if (Object.keys(extra).length) act(() => { useStore.setState(s => ({ S: { ...s.S, ...extra } })) })
    const more = [...document.querySelectorAll('button.iconbtn')].find(b => b.getAttribute('aria-label') === 'More')
    act(() => { more.click() })
    const sheet = useUI.getState().sheets.at(-1)
    const box = document.createElement('div')
    document.body.appendChild(box)
    const root = createRoot(box)
    mounted.push(root)
    act(() => root.render(sheet.render(() => {})))
    const rows = [...box.querySelectorAll('.menu-item')].map(r => [r.querySelector('.tt')?.textContent, r.querySelector('.ss')?.textContent])
    return { titles: rows.map(r => r[0]), subOf: title => rows.find(r => r[0] === title)?.[1] }
  }

  it('Simple: no plate loading, and nothing on « Exercise settings » that names progression', () => {
    const m = menuOf('simple')
    expect(m.titles).toContain('Exercise settings')
    expect(m.titles).not.toContain('Plate loading')
    expect(m.subOf('Exercise settings') || '').not.toMatch(/progression/i)
  })

  it.each(['normal', 'full'])('%s: plate loading is offered, and the settings line says what the sheet holds', level => {
    const m = menuOf(level)
    expect(m.titles).toContain('Plate loading')
    expect(m.subOf('Exercise settings')).toMatch(/progression/i)
  })

  it('Simple keeps plate loading for an exercise that has a bar weight of its own', () => {
    const m = menuOf('simple', { barWeights: { squat: 15 } })
    expect(m.titles).toContain('Plate loading')
  })
})
