// @vitest-environment happy-dom
// The tab bar is fixed on screen and re-renders on every store write — once a second for the
// whole of a rest. Its buttons must survive that: a component declared inside the render body is
// a new function each time, which React reads as a different type and rebuilds from scratch.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TabBar from './TabBar.jsx'
import { DEF, useStore } from '../store/useStore.js'

const where = vi.hoisted(() => ({ loc: { pathname: '/home' } }))
vi.mock('react-router-dom', () => ({
  useNavigate: () => () => {},
  useLocation: () => where.loc,
}))

//// Neoffice — whether the club has a coach or Nora is a hook of its own (lib/use-coach-doors.js): the test says it, it does not ask a server.
const doors = vi.hoisted(() => ({ value: { nora: false, human: false, any: false } }))
vi.mock('../lib/use-coach-doors.js', () => ({ useCoachDoors: () => doors.value }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, originalS, originalUser

beforeEach(() => {
  const store = useStore.getState()
  originalS = store.S
  originalUser = store.user
  //// Neoffice — classes off: the second place is then « Plan » (with the club's classes it is « Planning »), and the bar holds five buttons.
  useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), classesTab: false }, user: { id: 1, name: 'test' } })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useStore.setState({ S: originalS, user: originalUser })
  where.loc = { pathname: '/home' }
  doors.value = { nora: false, human: false, any: false }
})

const tabs = () => [...host.querySelectorAll('#tabbar button')]

describe('the tab bar across a store write', () => {
  it('keeps the very same buttons instead of rebuilding them every tick', () => {
    act(() => { root.render(<TabBar onStart={() => {}} />) })
    const before = tabs()
    expect(before).toHaveLength(5)  //// Neoffice — five places, the account is a round button on the screens

    // What a rest does once a second: S is replaced, so everything reading it re-renders.
    act(() => { useStore.getState().update(s => { s.restSec = 91 }, false) })

    const after = tabs()
    expect(after).toHaveLength(before.length)
    after.forEach((el, i) => expect(el).toBe(before[i]))
  })

  it('still lights the tab for the route it is on, and follows a change of state', () => {
    act(() => { root.render(<TabBar onStart={() => {}} />) })
    expect(tabs()[0].className).toBe('on')
    expect(tabs()[1].className).toBe('')
    expect(tabs()[2].className).toBe('start')

    act(() => { useStore.getState().update(s => { s.active = { id: 'a', entries: [], cur: 0 } }, false) })
    expect(tabs()[2].className).toBe('start rec')
    expect(tabs()[0].className).toBe('on')
  })
})

// v1.3.11 icon sweep: one icon per concept. Every tab carries its name under the icon, Start is a
// play button whether or not a session runs, and Exercises is the dumbbell (no more generic list).
describe('the tab icons and labels', () => {
  const icon = el => el.querySelector('svg')?.getAttribute('data-icon')
  const label = el => el.querySelector('span:last-child').textContent
  it('labels every tab and uses one icon per concept', () => {
    act(() => { root.render(<TabBar onStart={() => {}} />) })
    //// Neoffice — Plan is the clipboard (Planning, with the classes, is the calendar); the Start button is the middle one of five.
    expect(tabs().map(icon)).toEqual(['house', 'clipboard', 'play', 'dumbbell', 'chart'])
    expect(tabs().map(label)).toEqual(['Home', 'Plan', 'Start', 'Exercises', 'Stats'])

    act(() => { useStore.getState().update(s => { s.active = { id: 'a', entries: [], cur: 0 } }, false) })
    expect(icon(tabs()[2])).toBe('play')
    expect(label(tabs()[2])).toBe('Resume')
  })

  //// Neoffice — the club's classes make the second place « Planning », a coach (or Nora) makes the third one « Coach » instead of « Exercises »:
  //// the bar keeps its shape and the Start button its middle (lib/nav-model.js has the rest).
  it('names the second place Planning with the club’s classes, and the third one Coach when there is a coach', () => {
    useStore.setState({ S: { ...useStore.getState().S, classesTab: true } })
    doors.value = { nora: true, human: false, any: true }
    act(() => { root.render(<TabBar onStart={() => {}} />) })
    expect(tabs().map(icon)).toEqual(['house', 'calendar', 'play', 'chat', 'chart'])
    expect(tabs().map(label)).toEqual(['Home', 'Planning', 'Start', 'Coach', 'Stats'])
  })

  it('has no Account tab: the account is the round button on the screens', () => {
    act(() => { root.render(<TabBar onStart={() => {}} />) })
    expect(tabs().map(label)).not.toContain('Account')
  })

  //// Neoffice — Simple (30.10): no « Exercises » place without a coach, and the bar says how many it holds for the stylesheet.
  it('has no Exercises place at the Simple level, and counts its places for the stylesheet', () => {
    act(() => { useStore.getState().update(s => { s.level = 'simple' }, false) })
    act(() => { root.render(<TabBar onStart={() => {}} />) })
    expect(tabs().map(label)).toEqual(['Home', 'Plan', 'Start', 'Stats'])
    expect(document.querySelector('#tabbar').getAttribute('data-tabs')).toBe('4')
    act(() => { useStore.getState().update(s => { s.level = 'normal' }, false) })
    expect(tabs().map(label)).toEqual(['Home', 'Plan', 'Start', 'Exercises', 'Stats'])
    expect(document.querySelector('#tabbar').getAttribute('data-tabs')).toBe('5')
    act(() => { useStore.getState().update(s => { delete s.level }, false) })
  })

  //// Neoffice — the Start button is the middle COLUMN of a three-column grid, whatever the number of places on either side (the club: Start always stays
  //// in the middle). A layout is not measured by happy-dom, so the test pins what the layout rests on: the three children and the attribute the stylesheet reads.
  it('keeps the Start button alone in the middle of the bar, between the two sides', () => {
    act(() => { useStore.getState().update(s => { s.level = 'simple' }, false) })
    act(() => { root.render(<TabBar onStart={() => {}} />) })
    const bar = document.querySelector('#tabbar')
    expect(bar.getAttribute('data-layout')).toBe('centered')
    const kids = [...bar.children]
    expect(kids.map(k => k.className)).toEqual(['tab-side', 'start', 'tab-side'])
    act(() => { useStore.getState().update(s => { delete s.level }, false) })
  })

  it('shows a minimized session’s running time, still named Resume', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 9, 5, 18, 0, 0))
      act(() => { useStore.getState().update(s => { s.active = { id: 'a', entries: [], cur: 0, start: Date.now() - 754_000 } }, false) })
      act(() => { root.render(<TabBar onStart={() => {}} />) })
      const start = tabs()[2]
      expect(label(start)).toBe('12:34')
      expect(start.getAttribute('aria-label')).toBe('Resume')
      act(() => { vi.advanceTimersByTime(2000) })
      expect(label(start)).toBe('12:36')
      expect(tabs()[2]).toBe(start)   // the same button, only its text ticks

      // a past workout being edited has no clock running
      act(() => { useStore.getState().update(s => { s.active.editingWorkoutId = 'w1' }, false) })
      expect(label(tabs()[2])).toBe('Edit workout')
    } finally { vi.useRealTimers() }
  })
})

// A screen without a tab of its own keeps the tab it was opened from lit. Check-in, Progress photos
// and Body measurements lit none: Measurements moved under Stats (75a3b750) and the bar never heard.
describe('the tab a screen without its own lights', () => {
  const lit = () => tabs().filter(b => b.classList.contains('on')).map(b => b.textContent)
  it.each([
    ['/history', 'Stats'], ['/structural-balance', 'Stats'], ['/progress-photos', 'Stats'], ['/measurements', 'Stats'],
    //// Neoffice — Settings is reached by the round account button, no place of the bar is lit there.
    ['/checkin', 'Home'], ['/muscles', 'Exercises'],
  ])('%s lights %s', (pathname, tab) => {
    where.loc = { pathname }
    act(() => { root.render(<TabBar onStart={() => {}} />) })
    expect(lit()).toEqual([tab])
  })

  it.each(['/settings', '/settings/units', '/membership'])('%s lights no place: the account is not one', pathname => {
    where.loc = { pathname }
    act(() => { root.render(<TabBar onStart={() => {}} />) })
    expect(lit()).toEqual([])
  })

  it('Muscles opened from Stats lights Stats, the way its back button goes', () => {
    where.loc = { pathname: '/muscles', state: { from: '/stats' } }
    act(() => { root.render(<TabBar onStart={() => {}} />) })
    expect(lit()).toEqual(['Stats'])
  })
})
