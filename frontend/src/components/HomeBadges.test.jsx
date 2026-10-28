// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// The badges the club put forward on the home screen. Pinned: silence when the club has none (featured, or at all) so the home screen of most clubs
//// is untouched; silence offline; the three closest to their next level, with the ring and the sentence under it; the tap opens the badge case.

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ answer: null, fail: false }))
vi.mock('../lib/api.js', () => ({
  BOOT: {},
  getState: vi.fn(() => Promise.resolve({ state: null })), putState: vi.fn(() => Promise.resolve({})), logout: vi.fn(() => Promise.resolve({})),
  myBadges: () => (mocks.fail ? Promise.reject(new Error('offline')) : Promise.resolve(mocks.answer)),
}))
vi.mock('../lib/i18n.js', () => ({
  t: (s, ...a) => a.reduce((out, v, i) => out.replaceAll('{' + i + '}', v), s),
  tn: (one, other, n, ...rest) => [n, ...rest].reduce((out, v, i) => out.replaceAll('{' + i + '}', v), n === 1 ? one : other),
}))
vi.mock('../lib/format.js', () => ({ fmtNum: n => String(Math.round(n * 10) / 10) }))
vi.mock('./Icon.jsx', () => ({ default: ({ name }) => React.createElement('i', { 'data-icon': name }) }))

import HomeBadges from './HomeBadges.jsx'

const badge = (id, over = {}) => ({
  id, name: id, category: 'Performance', glyph: 'dumbbell', metric: 'Weight Moved', levels: 3, thresholds: [20000, 40000, 60000],
  tier: 1, next: 40000, value: 31200, progress: 0.78, featured: true, earned: true, ...over,
})

let root, container, opened
const render = async () => {
  await act(async () => { root.render(React.createElement(HomeBadges, { onOpen: () => { opened += 1 } })) })
  return container
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  mocks.fail = false
  opened = 0
  mocks.answer = { enabled: true, badges: [badge('Total soulevé')] }
})
afterEach(() => { act(() => root.unmount()); container.remove() })

describe('the badges on the home screen', () => {
  it('draw nothing for a club without badges, with badges off, with none featured, or offline', async () => {
    mocks.answer = { enabled: false, badges: [] }
    expect((await render()).textContent).toBe('')
    mocks.answer = { enabled: true, badges: [] }
    expect((await render()).textContent).toBe('')
    mocks.answer = { enabled: true, badges: [badge('a', { featured: false })] }
    expect((await render()).textContent).toBe('')
    mocks.answer = null
    expect((await render()).textContent).toBe('')
    mocks.fail = true
    mocks.answer = { enabled: true, badges: [badge('a')] }
    expect((await render()).textContent).toBe('')
  })

  it('a badge in progress: its ring, where it stands and the level to come', async () => {
    const c = await render()
    expect(c.textContent).toContain('Your badges')
    expect(c.textContent).toContain('Total soulevé')
    expect(c.textContent).toContain('31200 / 40000 kg')
    expect(c.textContent).toContain('Silver in 8800 kg')
    expect(c.querySelector('.ring-arc.silver')).toBeTruthy()          // the arc is in the colour of the level it climbs to
    expect(c.querySelector('.ring-in').textContent).toBe('78%')
    expect(c.querySelector('svg').getAttribute('aria-label')).toBe('78%')
  })

  it('a badge with every level reached: a full ring in the last medal, its icon in the centre, no progress line', async () => {
    mocks.answer = { enabled: true, badges: [badge('Régularité', { tier: 3, next: null, progress: 1, value: 12 })] }
    const c = await render()
    expect(c.querySelector('.ring-arc.gold')).toBeTruthy()
    expect(c.querySelector('.ring-in [data-icon]').getAttribute('data-icon')).toBe('dumbbell')
    expect(c.textContent).toContain('Gold reached')
    expect(c.textContent).not.toContain(' / ')
  })

  it('a badge with one level: its progress line only, no second sentence repeating it', async () => {
    mocks.answer = { enabled: true, badges: [badge('Semaines', { metric: 'Week Streak', levels: 1, thresholds: [4], tier: 0, next: 4, value: 1, progress: 0.25, earned: false })] }
    const c = await render()
    expect(c.textContent).toContain('1 / 4 weeks')
    expect([...c.querySelectorAll('.home-badge .small')].map(e => e.textContent)).toEqual(['1 / 4 weeks'])
    expect(c.querySelector('.ring-arc.bronze')).toBeNull()                 // no medal to climb to: the club's accent
  })

  it('shows at most three, the closest to their next level first', async () => {
    mocks.answer = { enabled: true, badges: ['a', 'b', 'c', 'd'].map((id, i) => badge(id, { progress: 0.2 + i * 0.2 })) }
    const c = await render()
    expect([...c.querySelectorAll('.home-badge .ttl')].map(e => e.textContent)).toEqual(['d', 'c', 'b'])
  })

  it('a tap opens the badge case', async () => {
    const c = await render()
    await act(async () => { c.querySelector('.card').click() })
    expect(opened).toBe(1)
  })
})
