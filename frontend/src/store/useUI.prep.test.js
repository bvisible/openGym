// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// The 3-2-1 before a timed set. What is pinned: the work timer starts at
//// ZERO of the count and not before (that was the bug — the hold began the
//// moment the button was tapped), a tap skips the wait, cancel starts nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn() }))

let useUI
beforeEach(async () => {
  vi.useFakeTimers()
  vi.resetModules()
  ;({ useUI } = await import('./useUI.js'))
})
afterEach(() => { useUI.getState().cancelPrep(); useUI.getState().stopWork(); vi.useRealTimers() })

describe('the 3-2-1 before a timed set', () => {
  it('counts three seconds, THEN starts the work timer', () => {
    const onDone = vi.fn()
    useUI.getState().startWorkWithPrep(45, 'Planche', onDone)
    expect(useUI.getState().prep).toMatchObject({ left: 3, total: 3, label: 'Planche' })
    //// The bug, as an assertion: during the count, no work timer runs.
    expect(useUI.getState().work).toBeNull()
    vi.advanceTimersByTime(1000); expect(useUI.getState().prep.left).toBe(2)
    vi.advanceTimersByTime(1000); expect(useUI.getState().prep.left).toBe(1)
    vi.advanceTimersByTime(1000)
    expect(useUI.getState().prep).toBeNull()
    expect(useUI.getState().work).toMatchObject({ total: 45, label: 'Planche' })
  })

  it('a tap starts the hold now', () => {
    useUI.getState().startWorkWithPrep(30, 'Gainage', vi.fn())
    useUI.getState().skipPrep()
    expect(useUI.getState().prep).toBeNull()
    expect(useUI.getState().work).toMatchObject({ total: 30 })
  })

  it('cancel starts nothing and logs nothing', () => {
    const onDone = vi.fn()
    useUI.getState().startWorkWithPrep(30, 'Gainage', onDone)
    useUI.getState().cancelPrep()
    vi.advanceTimersByTime(5000)
    expect(useUI.getState().prep).toBeNull()
    expect(useUI.getState().work).toBeNull()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('arming a second count replaces the first', () => {
    useUI.getState().startWorkWithPrep(30, 'A', vi.fn())
    useUI.getState().startWorkWithPrep(60, 'B', vi.fn())
    vi.advanceTimersByTime(3000)
    expect(useUI.getState().work).toMatchObject({ total: 60, label: 'B' })
  })
})

describe('what the work timer knows about the set it counts', () => {
  //// Since v1.3.10 that is upstream's `owner` ({ idx, i, id }), which a hold restored after a reload
  //// is bound to again; our count hands it through to startWork.
  it('carries the owner through the count to work.owner', () => {
    useUI.getState().startWorkWithPrep(45, 'Planche', vi.fn(), 3, { idx: 2, i: 1, id: 'plank' })
    expect(useUI.getState().work).toBeNull()
    vi.advanceTimersByTime(3000)
    expect(useUI.getState().work).toMatchObject({ total: 45, owner: { idx: 2, i: 1, id: 'plank' } })
  })
  it('has none when nothing was passed — a plain startWork stays as it was', () => {
    useUI.getState().startWork(30, 'x', vi.fn())
    expect(useUI.getState().work.owner).toBeUndefined()
  })
  it('tells the screen once the hold has started, after the hold it displaced handed back its time', () => {
    const order = []
    useUI.getState().startWork(60, 'First', elapsed => order.push(['first done', elapsed]))
    vi.advanceTimersByTime(5000)
    useUI.getState().startWorkWithPrep(45, 'Second', vi.fn(), 3, null, () => order.push(['second started', useUI.getState().work?.label]))
    expect(order).toEqual([])
    vi.advanceTimersByTime(3000)
    expect(order).toEqual([['first done', 8], ['second started', 'Second']])
  })
  it('a cancelled count never says it started', () => {
    const onStart = vi.fn()
    useUI.getState().startWorkWithPrep(45, 'Planche', vi.fn(), 3, null, onStart)
    useUI.getState().cancelPrep()
    vi.advanceTimersByTime(5000)
    expect(onStart).not.toHaveBeenCalled()
  })
})
