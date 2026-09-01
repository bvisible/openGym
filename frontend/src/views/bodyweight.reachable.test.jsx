// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// BODY WEIGHT IS DEMOTED, NOT HIDDEN — and the difference is the whole point.
////
//// Jérémy, 01.09: *"on avait une fixette sur le poids, de l'avoir relégué —
//// PAS de le planquer, le poids parce que c'est important, mais peut-être
//// relégué"*.
////
//// The change we made was to stop ASKING for it on the way into a workout,
//// because a number demanded before every session is not a neutral prompt for
//// somebody who does not want to think about their weight. That reasoning is
//// about being SOLICITED. It says nothing against the measurement, which is a
//// real training signal and one of the few things a member can watch move.
////
//// 🔴 The failure this pins is the one an over-zealous cleanup makes: reading
//// "the client wants body weight out of the way" and quietly removing the
//// entry points too. Then a member who WANTS to log their weight cannot, the
//// curve stops filling, and the feature dies of tidiness rather than of a
//// decision. So: at EVERY level, with the ask switched OFF, the weight is
//// still on Home, still on Stats, and still one tap from being logged.

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore, DEF, shouldAskWeighIn } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import Home from './Home.jsx'
import Stats from './Stats.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))

const state = level => ({
  level,
  //// The default, i.e. the journal never asks. This is precisely the state in
  //// which the entry points must still be there.
  weighInEvery: 'never',
  unit: 'kg', body: 'male', effort: null, targetW: 72,
  bodyweight: [{ d: '2026-08-01', w: 74, t: Date.parse('2026-08-01') },
               { d: '2026-08-20', w: 73, t: Date.parse('2026-08-20') }],
  workouts: [], routines: [], customEx: [], week: {}, dayPlan: {},
  exWeights: {}, active: null,
})

const mounted = []

const render = (Screen, level) => {
  useStore.setState(s => ({ S: { ...s.S, ...state(level) } }))
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(React.createElement(Screen)))
  return host
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [] })
  document.body.innerHTML = ''
})

afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('the journal does not ask', () => {
  it('is the default, and asking is a setting the member turns on', () => {
    expect(DEF.weighInEvery).toBe('never')
    expect(shouldAskWeighIn(DEF)).toBe(false)
    expect(shouldAskWeighIn({ weighInEvery: 'workout' })).toBe(true)
  })
})

describe('but the weight stays reachable, at every level', () => {
  for (const level of ['simple', 'normal', 'full']) {
    it(`Home shows it and can log it (${level})`, () => {
      const host = render(Home, level)
      const text = host.textContent || ''
      // The card is there…
      expect(text, level).toMatch(/Poids|Weight/i)
      // …and so is the button that records one. A card with no way to add to
      // it is a museum piece.
      const log = [...host.querySelectorAll('button')]
        .find(b => /^(Noter|Log)$/i.test(b.textContent.trim()))
      expect(log, `no log button on Home at ${level}`).toBeTruthy()
    })

    it(`Stats shows the curve and can log it (${level})`, () => {
      const host = render(Stats, level)
      const text = host.textContent || ''
      expect(text, level).toMatch(/Poids|Weight/i)
      const log = [...host.querySelectorAll('button')]
        .find(b => /^(Noter|Log)$/i.test(b.textContent.trim()))
      expect(log, `no log button on Stats at ${level}`).toBeTruthy()
    })
  }

  it('shows the history it has, rather than an empty promise', () => {
    // Two weigh-ins in the fixture; something on screen has to reflect them,
    // or "the weight is still there" is a claim about markup, not about the
    // member's data.
    const text = render(Stats, 'simple').textContent || ''
    expect(text).toMatch(/73|74/)
  })
})
