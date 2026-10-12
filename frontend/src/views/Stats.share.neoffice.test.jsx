// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent). « Recent workouts » on the Stats screen hands each row a Share button (onShare), and
//// the row's own tap still opens the detail.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Stats from './Stats.jsx'

const mocks = vi.hoisted(() => ({ S: {}, detail: vi.fn(), share: vi.fn(), rows: [] }))
vi.mock('../store/useStore.js', () => ({
  useStore: selector => selector({ S: mocks.S }),
  isSimple: () => false, atLeast: () => true, levelOf: () => 'full',
}))
vi.mock('../lib/level.js', () => ({ LEVELS: ['simple', 'normal', 'full'], isSimple: () => false, atLeast: () => true, levelOf: () => 'full' }))
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../sheets.jsx', () => ({
  weighInsSheet: () => {}, bwSheet: () => {}, goalSheet: () => {}, calendarSheet: () => {}, bwDeltaColor: () => 'inherit',
  workoutDetailSheet: (...a) => mocks.detail(...a),
  shareWorkoutImageSheet: (...a) => mocks.share(...a),
  WorkoutRow: props => { mocks.rows.push(props); return React.createElement('div', { className: 'wrow' }) },
}))

const wk = (n) => ({ id: 'w' + n, d: '2026-08-' + String(n).padStart(2, '0'), t: n, entries: [{ id: 'bench-press', sets: [{ w: 60, r: 5, done: true }] }] })
let container, root
beforeEach(() => {
  mocks.rows.length = 0; mocks.detail.mockClear(); mocks.share.mockClear()
  mocks.S = { unit: 'kg', body: 'male', effort: 'none', targetW: null, bodyweight: [], routines: [], customEx: [], workouts: [1, 2, 3, 4, 5, 6, 7, 8].map(wk) }
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); container.remove() })

describe('Stats — recent workouts can be shared in one tap', () => {
  it('six rows, newest first, each with a Share handler', () => {
    act(() => { root.render(React.createElement(Stats)) })
    expect(mocks.rows.map(r => r.w.id)).toEqual(['w8', 'w7', 'w6', 'w5', 'w4', 'w3'])
    expect(mocks.rows.every(r => typeof r.onShare === 'function')).toBe(true)
  })

  it('Share hands over THAT workout; the row\'s tap opens its detail', () => {
    act(() => { root.render(React.createElement(Stats)) })
    const row = mocks.rows[2]
    row.onShare(row.w)
    expect(mocks.share).toHaveBeenCalledWith(row.w)
    expect(mocks.detail).not.toHaveBeenCalled()
    row.onClick()
    expect(mocks.detail).toHaveBeenCalledWith(row.w)
  })
})
