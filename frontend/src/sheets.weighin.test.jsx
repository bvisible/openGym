// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// The weigh-in sheet, as the club asked for it on 31.08.
////
//// Two changes to upstream behaviour live here, and both are the kind a merge
//// reverts without a conflict:
////
////   1. Upstream asks for a body weight before EVERY workout. We made it
////      opt-in. Body weight is a SENSITIVE subject — for a member who does not
////      want to think about theirs, and a gym has those members, a number
////      demanded on the way in is not a neutral prompt. *"Le poids ça peut
////      être un problème pour les gens, donc mettre ça au second plan et pas
////      au premier"* (Jérémy, 31.08). Nothing was removed: the Log button and
////      the curve are untouched, and a member who WANTS the reminder turns it
////      on. The setting is about being ASKED, never about being able to.
////
////   2. The third button used to read "Choose a different workout" and to
////      NAVIGATE. The club: *"il y a un texte pour fermer mais ce n'est pas
////      clair que ça ferme"*. It now says it cancels — and cancelling means
////      the screen underneath is exactly where it was.
////
//// What is pinned below is the DIFFERENCE between the three buttons, because
//// that is what silently collapses: two of them start a workout, one does not,
//// and only one of the two records a weight.

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'

//// The navigation spy is the POINT of the cancel test, not a detail. Without
//// it, "cancel" passes just as happily with the bug it exists to catch: the
//// old handler did `close(); nav('/workout')`, which still closes the sheet
//// and still calls no onDone — both assertions below go green while the member
//// is thrown onto another screen. A test that cannot fail on the original bug
//// is decoration.
const nav = vi.hoisted(() => vi.fn())
vi.mock('./lib/nav.js', async orig => ({ ...(await orig()), nav }))

import { useStore, DEF, shouldAskWeighIn } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { bwSheet } from './sheets.jsx'

const mounted = []

function renderSheet(opts) {
  bwSheet(opts)
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return { host, sheet }
}

const buttonSaying = (host, text) =>
  [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [] })
  useStore.setState(s => ({ S: { ...s.S, unit: 'kg', bodyweight: [] } }))
  document.body.innerHTML = ''
  nav.mockClear()
})

afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('the weigh-in is asked, never imposed', () => {
  it('is off by default — a fresh member is never asked on their way in', () => {
    // The reversal itself. If this ever flips back to 'week' or 'workout',
    // every member in the fleet starts being asked again at the next deploy.
    expect(DEF.weighInEvery).toBe('never')
    expect(shouldAskWeighIn(DEF)).toBe(false)
  })

  it('asks a member who turned it on and has not weighed in for a week', () => {
    const old = { d: '2026-08-01', w: 70, t: Date.now() - 20 * 86400000 }
    expect(shouldAskWeighIn({ weighInEvery: 'week', bodyweight: [old] })).toBe(true)
  })
})

describe('the three buttons of the weigh-in sheet', () => {
  it('offers a way out that starts the workout, and a way out that does not', () => {
    const onDone = vi.fn()
    const { host } = renderSheet({ required: true, onDone })

    // Two of the three buttons lead into the workout; one leaves.
    expect(buttonSaying(host, 'Save & start workout')).toBeTruthy()
    expect(buttonSaying(host, 'Start without weighing in')).toBeTruthy()
    expect(buttonSaying(host, 'Cancel — don’t start yet')).toBeTruthy()
  })

  it('cancel closes the sheet and starts nothing', () => {
    // The club's actual complaint: the button said something ("choose a
    // different workout") that did not read as "this closes". Worse, it
    // navigated — so someone who tapped Start from Home and changed their mind
    // was moved to another screen instead of being left alone.
    const onDone = vi.fn()
    const { host } = renderSheet({ required: true, onDone })

    act(() => { buttonSaying(host, 'Cancel — don’t start yet').click() })

    expect(useUI.getState().sheets).toHaveLength(0)   // it closed
    expect(onDone).not.toHaveBeenCalled()             // it started nothing
    expect(nav).not.toHaveBeenCalled()                // and it moved nobody
  })

  it('“start without weighing in” starts the workout with no weight recorded', () => {
    // The distinction that matters between this button and the one above:
    // both close, only this one continues into the workout — and it must NOT
    // invent a weight to do so.
    const onDone = vi.fn()
    const { host } = renderSheet({ required: true, onDone })

    act(() => { buttonSaying(host, 'Start without weighing in').click() })

    expect(onDone).toHaveBeenCalledWith(null)
    expect(useStore.getState().S.bodyweight).toHaveLength(0)
  })

  it('the ✕ is a true no-op — no workout, no weight', () => {
    // The sheet opens `locked` (no swipe, no backdrop, no Escape) so a mistaken
    // tap on Start cannot be walked back by reflex. The ✕ is the deliberate
    // way out, and it must behave exactly like Cancel.
    const onDone = vi.fn()
    const { host } = renderSheet({ required: true, onDone })

    const close = host.querySelector('button[aria-label="Cancel"]')
    expect(close).toBeTruthy()
    act(() => { close.click() })

    expect(useUI.getState().sheets).toHaveLength(0)
    expect(onDone).not.toHaveBeenCalled()
    expect(nav).not.toHaveBeenCalled()
    expect(useStore.getState().S.bodyweight).toHaveLength(0)
  })

  it('saving records the weight once and continues into the workout', () => {
    const onDone = vi.fn()
    const { host } = renderSheet({ required: true, onDone })

    act(() => { buttonSaying(host, 'Save & start workout').click() })

    expect(onDone).toHaveBeenCalledTimes(1)
    expect(useStore.getState().S.bodyweight).toHaveLength(1)
  })

  it('the standalone sheet keeps its two buttons out of the way', () => {
    // Opened from Home or Stats to log a weight on purpose: no workout is
    // involved, so neither "start" button belongs there.
    const { host } = renderSheet({})

    expect(buttonSaying(host, 'Save')).toBeTruthy()
    expect(buttonSaying(host, 'Start without weighing in')).toBeFalsy()
    expect(buttonSaying(host, 'Cancel — don’t start yet')).toBeFalsy()
  })
})
