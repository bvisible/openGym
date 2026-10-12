// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent). Every workout row of the history carries the Share button; a note on a day off does not.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import History from './History.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))

const w = (id, d) => ({ id, d, name: 'Workout ' + id, start: 1000, end: 1000 + 30 * 60000, vol: 500, entries: [], routineId: null })
let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState(s => ({ S: { ...s.S, unit: 'kg', routines: [], active: null, workouts: [w('a', '2026-09-01'), w('b', '2026-09-05')], dayNotes: { '2026-09-03': { tag: 'sick', _ts: 1 } } } }))
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('History — sharing from the list', () => {
  it('a Share button on each workout, none on the day-off note', () => {
    act(() => root.render(<History />))
    expect(host.querySelectorAll('.item').length).toBe(3)
    expect(host.querySelectorAll('.wrow-share').length).toBe(2)
    expect(host.querySelector('.day-note-row .wrow-share')).toBeNull()
  })

  it('the button opens the share sheet of THAT workout; the row still opens its detail', () => {
    act(() => root.render(<History />))
    const rows = [...host.querySelectorAll('.item')].filter(r => !r.classList.contains('day-note-row'))
    act(() => { rows[0].querySelector('.wrow-share').click() })     // newest first: workout b
    const sheet = useUI.getState().sheets.at(-1)
    const box = document.createElement('div'); document.body.appendChild(box)
    const r2 = createRoot(box)
    act(() => r2.render(sheet.render(() => {})))
    expect(box.querySelector('h3').textContent).toBe('Share workout')
    act(() => r2.unmount()); box.remove()
    const before = useUI.getState().sheets.length
    act(() => { rows[1].querySelector('.tt').click() })
    expect(useUI.getState().sheets.length).toBe(before + 1)
    const detail = useUI.getState().sheets.at(-1)
    const box2 = document.createElement('div'); document.body.appendChild(box2)
    const r3 = createRoot(box2)
    act(() => r3.render(detail.render(() => {})))
    expect(box2.querySelector('h3').textContent).toBe('Workout a')
    act(() => r3.unmount()); box2.remove()
  })
})
