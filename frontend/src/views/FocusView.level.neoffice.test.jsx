// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// THE FOCUS VIEW'S EXERCISE MENU AT EACH DETAIL LEVEL (the same gates as the live session's menu,
//// lib/level-visibility.js): « Progression settings » and « Plate loading » are offered from the
//// Normal level up. At Simple they stay for an exercise that already carries a rule of its own or a
//// bar weight of its own ("hide the CONTROL, never the DATA").
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
  return [...sheetContainer.querySelectorAll('.menu-item')].map(el => el.querySelector('.tt')?.textContent)
}

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
  it('Simple: neither « Progression settings » nor « Plate loading »', () => {
    const titles = menuTitles('simple')
    expect(titles).toContain('Swap exercise')
    expect(titles).not.toContain('Progression settings')
    expect(titles).not.toContain('Plate loading')
  })

  it.each(['normal', 'full'])('%s: both are offered', level => {
    const titles = menuTitles(level)
    expect(titles).toContain('Progression settings')
    expect(titles).toContain('Plate loading')
  })

  it('Simple keeps « Progression settings » for an exercise with a rule of its own', () => {
    const titles = menuTitles('simple', { target: { sets: 1, reps: 5, weight: 95, prog: 'double' } })
    expect(titles).toContain('Progression settings')
    expect(titles).not.toContain('Plate loading')
  })

  it('Simple keeps « Plate loading » for an exercise with a bar weight of its own', () => {
    const titles = menuTitles('simple', { over: { barWeights: { [SQUAT]: 35 } } })
    expect(titles).toContain('Plate loading')
    expect(titles).not.toContain('Progression settings')
  })
})
