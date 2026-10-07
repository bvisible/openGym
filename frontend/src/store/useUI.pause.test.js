// @vitest-environment happy-dom
// Pausing the rest between sets (#193): paused time does not count, nothing announces the end at
// the old time, and resuming books the push again for the new one. The timed hold is its own timer.
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({
  //// Neoffice — BOOT: the page's boot data (lib/api.js), read by our screens at import.
  BOOT: {}, api: vi.fn(() => Promise.resolve({ ok: true })) }))
const { beep, chime } = vi.hoisted(() => ({ beep: vi.fn(), chime: vi.fn() }))
vi.mock('../lib/sound.js', () => ({ beep, chime, vibrate: vi.fn(), alertBuzz: vi.fn() }))

import { api } from '../lib/api.js'
import { useUI } from './useUI.js'
import { useStore } from './useStore.js'

const posts = path => api.mock.calls.filter(([p]) => p === path).map(([, o]) => JSON.parse(o.body))

describe('pausing the rest timer', () => {
  let original
  beforeEach(() => {
    vi.useFakeTimers()
    original = { S: useStore.getState().S, user: useStore.getState().user }
    useStore.setState({ S: { ...original.S, sound: true, timerFlash: true }, user: { id: 'u1' } })
    useUI.setState({ timer: null, work: null, timerFlashId: 0, toastMsg: '' })
    api.mockClear()
    beep.mockClear()
    chime.mockClear()
  })
  afterEach(() => {
    useUI.getState().stopRest()
    useUI.getState().stopWork()
    useStore.setState(original)
    vi.useRealTimers()
  })

  it('holds the time left while paused and runs it out after resuming', () => {
    useUI.getState().startRest(90, 1)
    vi.advanceTimersByTime(30000)
    useUI.getState().pauseRest()
    expect(useUI.getState().timer).toMatchObject({ left: 60, total: 90, paused: true, forIdx: 1 })

    vi.advanceTimersByTime(10 * 60000)   // a phone call
    expect(useUI.getState().timer).toMatchObject({ left: 60, paused: true })
    expect(useUI.getState().timer.ready).toBeUndefined()
    expect(beep).not.toHaveBeenCalled()
    expect(chime).not.toHaveBeenCalled()
    expect(useUI.getState().toastMsg).toBe('')

    useUI.getState().resumeRest()
    expect(useUI.getState().timer.paused).toBeUndefined()
    vi.advanceTimersByTime(59000)
    expect(useUI.getState().timer).toMatchObject({ left: 1 })
    vi.advanceTimersByTime(1000)
    expect(useUI.getState().timer).toMatchObject({ left: 0, ready: true, forIdx: 1 })
    expect(useUI.getState().timerFlashId).toBe(1)   // ended on screen: the usual alert
    expect(chime).toHaveBeenCalledTimes(1)
  })

  //// Neoffice — rewritten. Upstream books the rest's end on its own server's push and this
  //// test proved the pause cancels it and the resume books it again. Our server has no push
  //// relay (store/useUI.js, pushRestTimer is a named no-op), so what must hold is the
  //// opposite: start, pause and resume call no server at all, and the time left is still
  //// counted right for the local alert that stands in.
  it('books no server push on start, pause or resume, and still counts the time left', () => {
    useUI.getState().startRest(90)
    vi.advanceTimersByTime(20000)
    useUI.getState().pauseRest()   //// Neoffice — upstream asserts a cancel posted here; we post none
    vi.advanceTimersByTime(60000)
    useUI.getState().resumeRest()
    expect(posts('/api/push/rest-timer')).toEqual([])   //// Neoffice — no server push here
    expect(posts('/api/push/rest-timer/cancel')).toEqual([])
    expect(api).not.toHaveBeenCalled()
    expect(useUI.getState().timer).toMatchObject({ left: 70, total: 90 })
  })

  it('adds and takes off time while paused without booking anything', () => {
    useUI.getState().startRest(60)
    useUI.getState().pauseRest()
    api.mockClear()
    useUI.getState().addRest(15)
    expect(useUI.getState().timer).toMatchObject({ left: 75, total: 75, paused: true })
    expect(api).not.toHaveBeenCalled()
    useUI.getState().addRest(-90)
    expect(useUI.getState().timer).toBeNull()
  })

  it('has nothing to pause once the rest is over, and nothing to resume while it runs', () => {
    useUI.getState().startRest(1)
    vi.advanceTimersByTime(1000)
    useUI.getState().pauseRest()
    expect(useUI.getState().timer).toMatchObject({ ready: true })
    expect(useUI.getState().timer.paused).toBeUndefined()

    useUI.getState().startRest(30)
    const running = useUI.getState().timer
    useUI.getState().resumeRest()
    expect(useUI.getState().timer).toBe(running)
  })

  it('a set finished while paused starts its own rest, running', () => {
    useUI.getState().startRest(90, 0)
    useUI.getState().pauseRest()
    useUI.getState().startRest(60, 2)
    expect(useUI.getState().timer).toMatchObject({ left: 60, forIdx: 2 })
    expect(useUI.getState().timer.paused).toBeUndefined()
    vi.advanceTimersByTime(10000)
    expect(useUI.getState().timer.left).toBe(50)
  })

  it('leaves the timed hold alone: pausing is the rest\'s alone, and a hold still ends a paused rest', () => {
    const done = vi.fn()
    useUI.getState().startWork(45, 'Plank', done)
    useUI.getState().pauseRest()
    vi.advanceTimersByTime(5000)
    expect(useUI.getState().work).toMatchObject({ left: 40 })
    expect(useUI.getState().work.paused).toBeUndefined()
    useUI.getState().stopWork()

    useUI.getState().startRest(90)
    useUI.getState().pauseRest()
    useUI.getState().startWork(30, 'Plank', done)
    expect(useUI.getState().timer).toBeNull()
    vi.advanceTimersByTime(30000)
    expect(done).toHaveBeenCalledExactlyOnceWith(30, { chimed: true })
  })
})
