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
  it('carries the meta through the count to work.meta', () => {
    useUI.getState().startWorkWithPrep(45, 'Planche', vi.fn(), 3, { entryIdx: 2, setIdx: 1 })
    expect(useUI.getState().work).toBeNull()
    vi.advanceTimersByTime(3000)
    expect(useUI.getState().work).toMatchObject({ total: 45, meta: { entryIdx: 2, setIdx: 1 } })
  })
  it('is null when nothing was passed — a plain startWork stays as it was', () => {
    useUI.getState().startWork(30, 'x', vi.fn())
    expect(useUI.getState().work.meta).toBeNull()
  })
})
