// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// What the summary after a workout holds at each detail level (30.10, « de gros bébé »). At Simple: how long, how many sets, a record when
//// there is one, last time and next time, share. The volume, the muscle figure and « keep what you added » come back at Normal.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { finishWorkoutSheet } from './sheets.jsx'
import { EXDB } from './lib/exercises-data.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = v => JSON.parse(JSON.stringify(v))
const mounted = []

const top = () => {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const tap = (host, text) => {
  const target = [...host.querySelectorAll('button, .menu-item')].find(b => b.textContent.trim() === text)
  expect(target, text).toBeTruthy()
  act(() => { target.click() })
}
const summaryAt = level => {
  const st = clone(DEF)
  st.level = level
  st.active = {
    id: 'fin', d: '2026-10-30', start: Date.now() - 20 * 60000, routineId: null, name: 'Push', bw: null, cur: 0,
    entries: [{ id: EXDB[0].id, target: { mode: 'reps', sets: 1, reps: 5, weight: 40 }, sets: [{ w: 40, r: 5, done: true }] }],
  }
  useStore.setState({ S: st, user: null })
  act(() => finishWorkoutSheet({ onDiscard: () => {} }))
  tap(top(), 'Finish and save')
  return top().textContent
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

describe('the summary after a workout, by detail level', () => {
  it('Simple: the duration and the sets, and neither the volume nor the muscle figure', () => {
    const text = summaryAt('simple')
    expect(text).toContain('Workout complete!')
    expect(text).toContain('Duration')
    expect(text).toContain('Sets')
    expect(text).not.toContain('Volume')
    expect(text).not.toContain('What you just trained')
  })

  it.each(['normal', 'full'])('%s: the volume and the muscle figure are there', level => {
    const text = summaryAt(level)
    expect(text).toContain('Volume')
    expect(text).toContain('What you just trained')
  })
})
