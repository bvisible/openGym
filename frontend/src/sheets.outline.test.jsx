// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// THE SESSION OUTLINE: what is done, what is left.
////
//// Jérémy, 01.09: *"avoir un peu cette vue générale de qu'est-ce que j'ai
//// fait, qu'est-ce qui me reste à faire"*.
////
//// The workout screen already counted — a progress bar, "1/6 séries",
//// "Exercice 2 / 3". What it could not answer is WHICH ones are left:
//// exercises show one at a time, so finding out meant tapping Prev/Next
//// through the whole session.
////
//// What is pinned here is not that a list draws — that shows on screen. It is
//// the three things that make the list TRUE, and that a refactor breaks
//// without any of them failing loudly:
////
////   * warm-up rows are not counted (telling somebody "4 of 6" when they have
////     done one working set is worse than not counting at all);
////   * an exercise is "done" on its work sets, not on its position in the list;
////   * tapping a row goes THERE — a summary you cannot act on is a poster.

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { workoutOutlineSheet } from './sheets.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))

const mounted = []

//// Three exercises in three different states, which is the whole point: a
//// fixture where everything is done, or nothing, would pass a broken outline.
const session = () => ({
  id: 'live', d: '2026-09-01', start: Date.now(), routineId: null, name: 'Séance',
  bw: null, cur: 1,
  entries: [
    // 0 — finished: both work sets done.
    { id: '0025', target: {}, sets: [{ w: 60, r: 8, done: true }, { w: 60, r: 8, done: true }] },
    // 1 — in progress, and it is the current one (cur: 1).
    { id: '0027', target: {}, sets: [{ w: 40, r: 10, done: true }, { w: 40, r: 10, done: false }] },
    // 2 — not started, and carrying a WARM-UP row that must not be counted.
    { id: '0001', target: {}, sets: [
      { w: 20, r: 10, done: true, warmup: true },
      { w: 50, r: 8, done: false },
      { w: 50, r: 8, done: false },
    ] },
  ],
})

const open = (onPick = vi.fn()) => {
  useStore.setState(s => ({ S: { ...s.S, unit: 'kg', active: session() } }))
  workoutOutlineSheet(onPick)
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return { host, onPick }
}

const rows = host => [...host.querySelectorAll('.item')]

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [] })
  document.body.innerHTML = ''
})

afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  useStore.setState(s => ({ S: { ...s.S, active: null } }))
})

describe('the outline lists the whole session', () => {
  it('shows one row per exercise', () => {
    const { host } = open()
    expect(rows(host)).toHaveLength(3)
  })

  it('counts the exercises that are actually finished', () => {
    // One of three: the first. The second has a set left, the third has not
    // started — its done warm-up row must not promote it.
    const { host } = open()
    expect(host.textContent).toMatch(/1.*3/)
  })
})

describe('warm-up rows do not count', () => {
  it('reads the third exercise as 0 of 2, not 1 of 3', () => {
    // The trap: it carries a DONE warm-up set. Counting rows rather than work
    // sets would show "1 of 3" and mark progress the member has not made.
    const { host } = open()
    const third = rows(host)[2].textContent
    expect(third).toMatch(/0/)
    expect(third).toMatch(/2/)
    expect(third).not.toMatch(/3/)
  })

  it('reads the one in progress as 1 of 2', () => {
    const { host } = open()
    expect(rows(host)[1].textContent).toMatch(/1.*2/)
  })
})

describe('the outline is something you act on', () => {
  it('jumping to an exercise reports which one, and closes', () => {
    const { host, onPick } = open()
    act(() => { rows(host)[2].click() })
    expect(onPick).toHaveBeenCalledWith(2)
    // Closed: a summary that stays over the workout is in the way of the very
    // exercise it just sent you to.
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('names the exercises rather than showing ids', () => {
    // "0025" tells a member nothing about which movement is left.
    const { host } = open()
    const text = rows(host).map(r => r.querySelector('.tt').textContent).join(' | ')
    expect(text).not.toMatch(/^0025/)
    expect(text.length).toBeGreaterThan(20)
  })
})
