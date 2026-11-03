// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// THE FOCUS VIEW'S EXERCISE MENU AT EACH DETAIL LEVEL (the same gates as the live session's menu,
//// lib/level-visibility.js): since upstream v1.4.4 the menu leads with a few rows and folds the rest under « More »
//// (MenuSheet), where « Exercise settings » (which was « Progression settings ») and « Plate loading » live. « Plate loading »
//// is offered from the Normal level up, and « Exercise settings » names the exercise's progression from there too. At Simple
//// both stay for an exercise that already carries a rule of its own or a bar weight of its own ("hide the CONTROL, never the DATA").
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), unlock: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
const SQUAT = '0043'

let root, container, sheetRoot, sheetContainer

function menuTitles(level, { target = { sets: 1, reps: 5, weight: 95 }, over = {} } = {}) {
  const S = clone(DEF)
  S.unit = 'lb'
  S.level = level
  Object.assign(S, over)
  S.active = {
    id: 'focus-level', d: '2026-10-12', start: Date.now(), routineId: null,
    name: 'Focus', bw: null, cur: 0, workoutView: 'focus',
    entries: [{ id: SQUAT, target, sets: [{ w: 95, r: 5, done: false }] }],
  }
  useStore.setState({ S, user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
  act(() => container.querySelector('button[aria-label="More"]').click())
  const sheet = useUI.getState().sheets.at(-1)
  sheetContainer = document.createElement('div')
  document.body.appendChild(sheetContainer)
  sheetRoot = createRoot(sheetContainer)
  act(() => sheetRoot.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  // The rarely used rows are folded under « More »: open it, as a member would.
  const more = sheetContainer.querySelector('.menu-more')
  if (more) act(() => more.click())
  return [...sheetContainer.querySelectorAll('.menu-item')].map(el => ({ title: el.querySelector('.tt')?.textContent, sub: el.querySelector('.ss')?.textContent }))
}
const titlesOf = items => items.map(i => i.title)
const subOf = (items, title) => items.find(i => i.title === title)?.sub

beforeEach(() => {
  useUI.setState({ sheets: [], toastMsg: '', timer: null, work: null })
})

afterEach(() => {
  if (sheetRoot) act(() => sheetRoot.unmount())
  if (sheetContainer) sheetContainer.remove()
  if (root) act(() => root.unmount())
  if (container) container.remove()
  sheetRoot = sheetContainer = root = container = null
  useUI.getState().stopRest()
})

describe('the focus view exercise menu at each detail level', () => {
  it('Simple: no « Plate loading », and « Exercise settings » does not name the progression', () => {
    const items = menuTitles('simple')
    expect(titlesOf(items)).toContain('Swap exercise')
    expect(titlesOf(items)).toContain('Exercise settings')
    expect(subOf(items, 'Exercise settings')).toBeUndefined()
    expect(titlesOf(items)).not.toContain('Plate loading')
  })

  it.each(['normal', 'full'])('%s: both are offered', level => {
    const items = menuTitles(level)
    expect(subOf(items, 'Exercise settings')).toBeTruthy()
    expect(titlesOf(items)).toContain('Plate loading')
  })

  it('Simple keeps the progression in « Exercise settings » for an exercise with a rule of its own', () => {
    const items = menuTitles('simple', { target: { sets: 1, reps: 5, weight: 95, prog: 'double' } })
    expect(subOf(items, 'Exercise settings')).toBeTruthy()
    expect(titlesOf(items)).not.toContain('Plate loading')
  })

  it('Simple keeps « Plate loading » for an exercise with a bar weight of its own', () => {
    const items = menuTitles('simple', { over: { barWeights: { [SQUAT]: 35 } } })
    expect(titlesOf(items)).toContain('Plate loading')
    expect(subOf(items, 'Exercise settings')).toBeUndefined()
  })
})
