// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// THE CLIENT'S ACTUAL REQUEST, AS A TEST.
////
//// Olympia, 31.08: *"on a des données qui sont très techniques, trop
//// techniques. Un débutant, ça peut lui faire peur […] ça a ce côté
//// rédhibitoire."* Every other level test pins ONE rule or ONE screen. This
//// one pins the PROMISE: at the simple and normal levels, the technical
//// vocabulary is not on screen. Anywhere.
////
//// 🔴 WHY THIS FILE EXISTS AND THE OTHERS ARE NOT ENOUGH.
////
//// openGym is a fork we re-merge with upstream regularly (105 commits in
//// v1.2.14 alone). Upstream is built by and for advanced lifters: every merge
//// brings new strings, and NOTHING about a new "RIR" label anywhere in the app
//// would fail a build, a lint, or any test that names a specific screen. It
//// would simply appear, one day, in front of a beginner.
////
//// So this test does not check a rule. It searches the RENDERED TEXT of the
//// screens for a vocabulary list, and fails on any hit. A merge that
//// reintroduces jargon lands here, with the term and the screen named.
////
//// It is written to be EXTENDED, not admired: when a new technical term
//// enters the product, add it to JARGON. That is the whole maintenance cost.

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import Stats from './Stats.jsx'
import Workout from './Workout.jsx'
import Settings from './Settings.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))

//// The vocabulary a beginner was never taught, as it appears ON SCREEN in
//// French — matched case-insensitively. English source strings are listed too:
//// an untranslated string is exactly how a merge shows up.
////
//// Deliberately NOT in this list: "série", "répétitions", "poids", "repos",
//// "échauffement". Those are the words of the room, not of the literature —
//// hiding them would stop being a simpler journal and start being a smaller
//// one.
const JARGON = [
  'RIR', 'RPE',                       // the effort scales
  'Epley',                            // the formula behind the estimated max
  'drop set', 'drop-set',             // intensity techniques
  'rest-pause', 'rest pause', 'myo',
  'superset',
  'tonnage', 'monotonie',             // the load-management readings
]

//// "1RM" is the one term the levels treat differently, so it is listed apart:
//// the estimated max IS offered from `normal` up (a member past their first
//// weeks wants to know roughly what they could lift, and the label says
//// "estimé"). It must still be absent at `simple`.
const JARGON_SIMPLE_ONLY = ['1RM']

//// A member with real history, so the screens have something to draw and the
//// jargon has every chance to appear. A blank state would pass this test for
//// the wrong reason.
const workout = (d, id, extra = {}) => ({
  id: 'w' + d, d, t: Date.parse(d + 'T18:00:00'), name: 'Séance',
  entries: [{
    id, target: {}, sets: [
      { w: 60, r: 8, done: true },
      { w: 60, r: 6, done: true },
    ], ...extra,
  }],
})

const populated = level => ({
  level,
  //// `effort: null` — the default. Setting it to 'rir' would trip the
  //// deliberate "hide the control, never the data" exception (a member who
  //// already logs RIR keeps the setting, so they can switch it off), and this
  //// test would then be measuring that exception rather than the level. That
  //// exception has its own test in lib/level-visibility.test.js.
  unit: 'kg', body: 'male', effort: null, targetW: 72,
  bodyweight: [{ d: '2026-08-01', w: 74, t: Date.parse('2026-08-01') },
               { d: '2026-08-20', w: 73, t: Date.parse('2026-08-20') }],
  workouts: [workout('2026-08-18', '0025'), workout('2026-08-20', '0025'),
             workout('2026-08-22', '0027')],
  routines: [], customEx: [], week: {}, dayPlan: {}, exWeights: {},
  active: {
    id: 'live', d: '2026-08-25', start: Date.now(), routineId: null, name: 'Séance',
    bw: null, cur: 0,
    entries: [{ id: '0025', target: {}, sets: [{ w: 60, r: 8, done: false }] }],
  },
})

const mounted = []

const render = (Screen, level) => {
  useStore.setState(s => ({ S: { ...s.S, ...populated(level) } }))
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(React.createElement(Screen)))
  return host.textContent || ''
}

const found = (text, terms = JARGON) => terms.filter(term => new RegExp(term.replace(/[-\s]/g, '[-\\s]?'), 'i').test(text))

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [] })
  document.body.innerHTML = ''
})

afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

const SCREENS = [['Stats', Stats], ['Workout', Workout], ['Settings', Settings]]

describe('no technical vocabulary at the simple level', () => {
  for (const [label, Screen] of SCREENS) {
    it(`${label} shows none of it`, () => {
      const hits = found(render(Screen, 'simple'), [...JARGON, ...JARGON_SIMPLE_ONLY])
      //// The message names the term AND the screen, because "a test failed"
      //// is not actionable six months from now on a 105-commit merge.
      expect(hits, `${label} (simple) shows: ${hits.join(', ')}`).toEqual([])
    })
  }
})

describe('no technical vocabulary at the normal level either', () => {
  //// Normal is where most members sit: past the first weeks, wanting the body
  //// map and the estimated max — but "1RM" and "RIR" are still terms you have
  //// to be taught. Only the FULL level speaks them.
  for (const [label, Screen] of SCREENS) {
    it(`${label} shows none of it`, () => {
      const hits = found(render(Screen, 'normal'))
      expect(hits, `${label} (normal) shows: ${hits.join(', ')}`).toEqual([])
    })
  }
})

describe('the full level is not a smaller product', () => {
  it('still speaks the vocabulary somewhere', () => {
    //// The other half of the contract, and the reason this is not just three
    //// "expect empty" tests: if a refactor removed the technical features
    //// outright, every test above would go green while the product lost what
    //// advanced members came for. Something must still say it.
    const text = SCREENS.map(([, Screen]) => render(Screen, 'full')).join(' ')
    expect(found(text, [...JARGON, ...JARGON_SIMPLE_ONLY]).length).toBeGreaterThan(0)
  })
})
